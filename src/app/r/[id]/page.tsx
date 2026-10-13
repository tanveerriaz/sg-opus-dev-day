import { notFound } from "next/navigation";
import { DinerApp } from "@/components/diner/DinerApp";
import { parseDinerContext } from "@/lib/menu";
import { getRestaurant } from "@/lib/restaurants";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string | string[]; t?: string | string[] }>;
};

export default async function DinerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const context = parseDinerContext(await searchParams);
  const restaurant = await getRestaurant(id);
  if (!restaurant) notFound();

  return <DinerApp restaurant={restaurant} context={context} />;
}
