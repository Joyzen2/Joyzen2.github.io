export default function HoverLabel({ children, alternate = children }) {
  return <span className="hover-label"><span className="hover-label-main">{children}</span><span className="hover-label-alt" aria-hidden="true">{alternate}</span></span>;
}
