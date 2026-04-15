export default function MovingObjectsLayer() {
  return (
    <div aria-hidden="true" className="moving-objects pointer-events-none absolute inset-5 overflow-hidden">
      <span className="motion-object motion-object-orb" />
      <span className="motion-object motion-object-card" />
      <span className="motion-object motion-object-ring" />
      <span className="motion-object motion-object-dot" />
    </div>
  );
}
