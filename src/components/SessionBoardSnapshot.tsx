import type { LocalCampaignEntity, LocalSessionScene } from '../fixtures/localCampaignCatalog'
import { scenePosition, sceneSize, tokenPosition } from '../lib/localSessionBoard'

/** Pure SVG: printable without depending on viewport, zoom or a mounted canvas. */
export function SessionBoardSnapshot({ scenes, entities }: { scenes: LocalSessionScene[]; entities: LocalCampaignEntity[] }) {
  if (!scenes.length) return null
  const boxes = scenes.map((scene, index) => ({ scene, ...scenePosition(scene, index), ...sceneSize(scene) }))
  const left = Math.min(...boxes.map((box) => box.x)) - 24
  const top = Math.min(...boxes.map((box) => box.y)) - 24
  const width = Math.max(...boxes.map((box) => box.x + box.width)) - left + 24
  const height = Math.max(...boxes.map((box) => box.y + box.height)) - top + 24
  return <svg className="session-board-snapshot" role="img" aria-label="Расположение сцен и материалов сессии" viewBox={`${left} ${top} ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
    <title>Доска сцен сессии</title>
    {boxes.flatMap((box) => (box.scene.nextSceneIds ?? []).map((id) => {
      const target = boxes.find((item) => item.scene.id === id)
      if (!target) return null
      const x1 = box.x + box.width; const y1 = box.y + box.height / 2; const x2 = target.x; const y2 = target.y + target.height / 2
      return <g key={`${box.scene.id}-${id}`}><path d={`M ${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`} fill="none" stroke="#555" strokeWidth="2" /><path d={`M ${x2 - 9} ${y2 - 5} L ${x2} ${y2} L ${x2 - 9} ${y2 + 5}`} fill="none" stroke="#555" strokeWidth="2" /></g>
    }))}
    {boxes.map((box, index) => <g key={box.scene.id} transform={`translate(${box.x} ${box.y})`}>
      <rect width={box.width} height={box.height} fill="white" stroke="#555" strokeWidth="2" rx="10" />
      <text x="12" y="25" fill="#111" fontSize="16" fontFamily="sans-serif">{index + 1}. {box.scene.title.slice(0, Math.floor(box.width / 10))}</text>
      <line x1="0" y1="50" x2={box.width} y2="50" stroke="#ccc" />
      {(box.scene.memberIds ?? []).map((id) => { const point = tokenPosition(box.scene, id); return <g key={id} transform={`translate(${point.x} ${point.y})`}><rect width="180" height="44" fill="#f4f4f4" stroke="#666" rx="6" /><text x="8" y="27" fill="#111" fontSize="13" fontFamily="sans-serif">{(entities.find((entity) => entity.id === id)?.name ?? 'Удалённый объект').slice(0, 24)}</text></g> })}
    </g>)}
  </svg>
}
