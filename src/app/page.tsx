import SobrePage from "@/src/components/SobrePage";
import ContatoPage from "@/src/components/ContatoPage";
import PoliticaDeTrocasPage from "@/src/components/PoliticaDeTrocasPage";
import ReferenciaDeMedidasPage from "@/src/components/ReferenciaDeMedidasPage";

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
