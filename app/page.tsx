import { AirportDirectory } from "@/app/components/airport-directory";
import { getAllHonestAirports } from "@/lib/airport-catalog";

export default async function HomePage() {
  const airports = await getAllHonestAirports();

  return <AirportDirectory airports={airports} />;
}
