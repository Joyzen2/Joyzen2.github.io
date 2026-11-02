// Shared heading for screens 02–05: index label, serif title and an optional lede/hint.
// Narrow screens wrap the title only after its comma, never inside a phrase.
const phrases = title => title.split('，').map((part, i, all) => i < all.length - 1 ? `${part}，` : part);

export default function NarrativeHead({ id, index, title, lede, hint }) {
  return <header className="narrative-head">
    <p className="narrative-index" data-reveal>{index}</p>
    <h2 id={id} className="narrative-title"><span className="heading-mask"><span data-reveal-title>{phrases(title).map(part => <span key={part} className="narrative-phrase">{part}</span>)}</span></span></h2>
    {lede && <p className="narrative-lede" data-reveal>{lede}</p>}
    {hint && <p className="narrative-hint" data-reveal>{hint}</p>}
  </header>;
}
