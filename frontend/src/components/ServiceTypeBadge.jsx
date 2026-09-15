const META = { RIDE: "Ride", TOUR: "Tour", DRIVER_RENTAL: "Driver rental" };
export default function ServiceTypeBadge({ type }) {
  return <span className="service-badge">{META[type] || type}</span>;
}