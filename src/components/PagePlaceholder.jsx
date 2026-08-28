export default function PagePlaceholder({ title, description }) {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Zen</p>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
      </div>
      <div className="placeholder-card">
        <strong>UI implementation starts here.</strong>
        <span>This route is connected and ready for the supplied design.</span>
      </div>
    </section>
  );
}