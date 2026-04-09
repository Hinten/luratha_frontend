import SobrePage from "@/src/app/sobre/page";
import ContatoPage from "@/src/app/contato/page";
import PoliticaDeTrocasPage from "@/src/app/politica-de-trocas/page";
import ReferenciaDeMedidasPage from "@/src/app/referencia-de-medidas/page";

type SearchParams = Promise<{ _page?: string }>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = params._page;

  if (page === "sobre") return <SobrePage />;
  if (page === "contato") return <ContatoPage />;
  if (page === "politica-de-trocas") return <PoliticaDeTrocasPage />;
  if (page === "referencia-de-medidas") return <ReferenciaDeMedidasPage />;

  return (
    <div>
      <h1>Home</h1>
    </div>
  );
}
