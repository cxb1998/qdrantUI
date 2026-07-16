import { Separator } from 'react-resizable-panels'

/** 与官方 Graph 页 PanelResizeHandle 一致：10px 宽、浅色底、居中 ⋮ 握把 */
export function GraphPanelSeparator() {
  return (
    <Separator className="graph-panel-separator">
      <div className="graph-panel-separator-grip" aria-hidden>
        ⋮
      </div>
    </Separator>
  )
}
