import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react'
import { qdrant } from '../../lib/qdrant'
import {
  buildFilterInputFromConditions,
  calculateFilterAutocompleteOffset,
  getCurrentWord,
  getCurrentWordStart,
  normalizeFilterInput,
  parseFilterString,
  uniqFilters,
  type PayloadFilterCondition,
} from '../../lib/pointsFilter'
import { IconFilter } from '../ui/icons'

const MAX_OPTIONS = 10

function sortByLengthAndAlpha(a: string, b: string) {
  if (a.length !== b.length) return a.length - b.length
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

export function PayloadFilterField({
  collectionName,
  filters,
  onFiltersChange,
  payloadSchema,
}: {
  collectionName: string
  filters: PayloadFilterCondition[]
  onFiltersChange: (filters: PayloadFilterCondition[]) => void
  payloadSchema: Record<string, unknown>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestedFacetsRef = useRef(new Set<string>())

  const [inputValue, setInputValue] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [isFocused, setIsFocused] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [payloadValues, setPayloadValues] = useState<Record<string, string[]>>({})

  const payloadKeyOptions = useMemo(
    () => Object.keys(payloadSchema).sort((a, b) => a.localeCompare(b)),
    [payloadSchema],
  )

  useEffect(() => {
    setInputValue(buildFilterInputFromConditions(filters))
  }, [filters])

  useEffect(() => {
    setPayloadValues({})
    requestedFacetsRef.current.clear()
  }, [collectionName, payloadSchema])

  const syncCursor = useCallback(() => {
    const pos = inputRef.current?.selectionStart ?? inputValue.length
    setCursorPosition(pos)
  }, [inputValue.length])

  const currentWord = useMemo(
    () => getCurrentWord(inputValue, cursorPosition),
    [inputValue, cursorPosition],
  )
  const currentWordStart = useMemo(
    () => getCurrentWordStart(inputValue, cursorPosition),
    [inputValue, cursorPosition],
  )

  const { isTypingValue, currentKey, currentValuePart } = useMemo(() => {
    const colonIndex = currentWord.indexOf(':')
    if (colonIndex === -1) {
      return { isTypingValue: false, currentKey: '', currentValuePart: '' }
    }
    return {
      isTypingValue: true,
      currentKey: currentWord.slice(0, colonIndex),
      currentValuePart: currentWord.slice(colonIndex + 1),
    }
  }, [currentWord])

  const requestFacetValues = useCallback(
    async (key: string) => {
      if (!key || requestedFacetsRef.current.has(key)) return
      const fieldInfo = payloadSchema[key] as { data_type?: string } | undefined
      if (!fieldInfo || fieldInfo.data_type !== 'keyword') return

      requestedFacetsRef.current.add(key)
      try {
        const res = await qdrant.facet(collectionName, key, 50)
        const values = res.hits.map((hit) => String(hit.value))
        if (values.length > 0) {
          setPayloadValues((prev) => ({ ...prev, [key]: values }))
        }
      } catch {
        requestedFacetsRef.current.delete(key)
      }
    },
    [collectionName, payloadSchema],
  )

  useEffect(() => {
    if (isTypingValue && currentKey) {
      void requestFacetValues(currentKey)
    }
  }, [isTypingValue, currentKey, requestFacetValues])

  const filteredOptions = useMemo(() => {
    if (isTypingValue) {
      const values = payloadValues[currentKey] || []
      if (values.length === 0) return []
      const loweredValuePart = currentValuePart.toLowerCase()
      return values
        .filter((stringValue) => {
          const lowered = stringValue.toLowerCase()
          if (lowered === loweredValuePart) return false
          return !currentValuePart || lowered.startsWith(loweredValuePart)
        })
        .sort(sortByLengthAndAlpha)
        .slice(0, MAX_OPTIONS)
    }

    const loweredWord = currentWord.toLowerCase()
    return payloadKeyOptions
      .filter((option) => {
        if (!currentWord) return false
        const loweredOption = option.toLowerCase()
        return loweredOption.startsWith(loweredWord) && loweredOption !== loweredWord
      })
      .sort(sortByLengthAndAlpha)
      .slice(0, MAX_OPTIONS)
  }, [
    currentWord,
    payloadKeyOptions,
    isTypingValue,
    currentKey,
    currentValuePart,
    payloadValues,
  ])

  useEffect(() => {
    if (!isFocused) {
      setIsOpen(false)
      return
    }
    const hasKeyOptions = !isTypingValue && !!currentWord && payloadKeyOptions.length > 0
    const hasValueOptions = isTypingValue && (payloadValues[currentKey] || []).length > 0
    setIsOpen(hasKeyOptions || hasValueOptions)
    setHighlightedIndex(0)
  }, [currentWord, payloadKeyOptions.length, isFocused, isTypingValue, currentKey, payloadValues])

  const popperLeft = useMemo(
    () => calculateFilterAutocompleteOffset(inputValue, currentWordStart),
    [inputValue, currentWordStart],
  )

  const applyFilters = useCallback(
    (raw: string) => {
      const normalized = normalizeFilterInput(raw)
      if (normalized !== raw) setInputValue(normalized)
      onFiltersChange(uniqFilters(parseFilterString(normalized, payloadSchema)))
    },
    [onFiltersChange, payloadSchema],
  )

  const selectOption = useCallback(
    (option: string) => {
      const beforeCursor = inputValue.slice(0, cursorPosition)
      const afterCursor = inputValue.slice(cursorPosition)
      const wordMatch = beforeCursor.match(/(\S*)$/)
      const wordStart = wordMatch ? cursorPosition - wordMatch[1].length : cursorPosition

      let newInputValue: string
      let newCursorPos: number

      if (isTypingValue) {
        const keyWithColon = `${currentKey}:`
        newInputValue =
          inputValue.slice(0, wordStart) +
          keyWithColon +
          option +
          afterCursor.replace(/^\S*/, '')
        newCursorPos = wordStart + keyWithColon.length + option.length
      } else {
        newInputValue =
          inputValue.slice(0, wordStart) + option + ':' + afterCursor.replace(/^\S*/, '')
        newCursorPos = wordStart + option.length + 1
      }

      setInputValue(newInputValue)
      setIsOpen(false)
      requestAnimationFrame(() => {
        const input = inputRef.current
        if (!input) return
        input.focus()
        input.setSelectionRange(newCursorPos, newCursorPos)
        setCursorPosition(newCursorPos)
      })
    },
    [inputValue, cursorPosition, isTypingValue, currentKey],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (isOpen && filteredOptions.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length)
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setHighlightedIndex(
            (prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length,
          )
          return
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault()
          selectOption(filteredOptions[highlightedIndex])
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setIsOpen(false)
          return
        }
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        applyFilters(inputValue)
      }
    },
    [isOpen, filteredOptions, highlightedIndex, selectOption, applyFilters, inputValue],
  )

  const handleChange = useCallback(
    (value: string) => {
      setInputValue(value)
      setHighlightedIndex(0)
      setCursorPosition(value.length)
      if (!value.trim() && filters.length > 0) {
        onFiltersChange([])
      }
    },
    [onFiltersChange, filters.length],
  )

  const handleInputEvent = useCallback(
    (_event: SyntheticEvent<HTMLInputElement>) => {
      syncCursor()
    },
    [syncCursor],
  )

  useEffect(() => {
    if (!isOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen])

  const showDropdown = isOpen && filteredOptions.length > 0

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <IconFilter className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-base text-muted-soft" />
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onClick={handleInputEvent}
        onKeyUp={handleInputEvent}
        onSelect={handleInputEvent}
        placeholder="file_name:example.jpg line_id:>=1 score:>=0.8 score:<=1"
        spellCheck={false}
        autoComplete="off"
        className="h-9.5 w-full rounded-lg border bg-surface pl-8 pr-3 font-mono text-[13px] text-ink transition placeholder:text-muted-soft focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/15"
      />
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 min-w-[10rem] overflow-y-auto rounded-lg border bg-surface py-1 shadow-lg"
          style={{ left: popperLeft }}
        >
          {filteredOptions.map((option, index) => (
            <li key={option} role="option" aria-selected={index === highlightedIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
                className={`block w-full cursor-pointer truncate px-3 py-1.5 text-left font-mono text-[13px] ${
                  index === highlightedIndex
                    ? 'bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]'
                    : 'text-ink hover:bg-surface-2'
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
