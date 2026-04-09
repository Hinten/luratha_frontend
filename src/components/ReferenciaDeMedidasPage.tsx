const SIZE_CHART = [
  { size: "PP", bust: "80–84", waist: "62–66", hip: "88–92" },
  { size: "P", bust: "84–88", waist: "66–70", hip: "92–96" },
  { size: "M", bust: "88–92", waist: "70–74", hip: "96–100" },
  { size: "G", bust: "92–96", waist: "74–78", hip: "100–104" },
  { size: "GG", bust: "96–100", waist: "78–82", hip: "104–108" },
  { size: "XGG", bust: "100–108", waist: "82–90", hip: "108–116" },
];

export default function ReferenciaDeMedidasPage() {
  return (
    <div className="container-luratha section-padding">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--color-neutral-dark)",
            }}
            className="mb-4"
          >
            Referência de Medidas
          </h1>
          <p
            className="text-lg leading-relaxed"
            style={{ color: "var(--color-neutral-dark)", opacity: 0.75 }}
          >
            Encontre o seu tamanho ideal. Todas as medidas estão em
            centímetros.
          </p>
        </div>

        {/* How to measure */}
        <div
          className="rounded-3xl p-8 mb-12"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          <h2
            className="text-xl font-semibold mb-4"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--color-neutral-dark)",
            }}
          >
            Como medir corretamente
          </h2>
          <ul className="flex flex-col gap-3">
            {[
              {
                label: "Busto",
                tip: "Meça ao redor da parte mais larga do busto, com os braços relaxados ao lado do corpo.",
              },
              {
                label: "Cintura",
                tip: "Meça ao redor da parte mais estreita da cintura, geralmente 2–3 cm acima do umbigo.",
              },
              {
                label: "Quadril",
                tip: "Meça ao redor da parte mais larga do quadril, geralmente 18–20 cm abaixo da cintura.",
              },
            ].map(({ label, tip }) => (
              <li
                key={label}
                className="flex gap-3"
                style={{ color: "var(--color-neutral-dark)", opacity: 0.85 }}
              >
                <span
                  className="font-medium shrink-0"
                  style={{ color: "var(--color-neutral-dark)" }}
                >
                  {label}:
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Size chart table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-neutral-dark)",
                }}
              >
                <th
                  className="px-6 py-4 text-left font-semibold rounded-tl-2xl"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Tamanho
                </th>
                <th
                  className="px-6 py-4 text-left font-semibold"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Busto (cm)
                </th>
                <th
                  className="px-6 py-4 text-left font-semibold"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Cintura (cm)
                </th>
                <th
                  className="px-6 py-4 text-left font-semibold rounded-tr-2xl"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Quadril (cm)
                </th>
              </tr>
            </thead>
            <tbody>
              {SIZE_CHART.map(({ size, bust, waist, hip }, i) => (
                <tr
                  key={size}
                  style={{
                    backgroundColor:
                      i % 2 === 0
                        ? "var(--color-neutral-light)"
                        : "var(--color-accent)",
                  }}
                >
                  <td
                    className="px-6 py-4 font-semibold"
                    style={{ color: "var(--color-neutral-dark)" }}
                  >
                    {size}
                  </td>
                  <td
                    className="px-6 py-4"
                    style={{ color: "var(--color-neutral-dark)", opacity: 0.85 }}
                  >
                    {bust}
                  </td>
                  <td
                    className="px-6 py-4"
                    style={{ color: "var(--color-neutral-dark)", opacity: 0.85 }}
                  >
                    {waist}
                  </td>
                  <td
                    className="px-6 py-4"
                    style={{ color: "var(--color-neutral-dark)", opacity: 0.85 }}
                  >
                    {hip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tip note */}
        <p
          className="mt-8 text-sm text-center"
          style={{ color: "var(--color-neutral-dark)", opacity: 0.6 }}
        >
          Em caso de dúvida entre dois tamanhos, recomendamos escolher o maior.
          Se precisar de ajuda,{" "}
          <a
            href="/contato"
            className="font-medium underline underline-offset-2"
            style={{ color: "var(--color-neutral-dark)", opacity: 1 }}
          >
            fale conosco
          </a>
          .
        </p>
      </div>
    </div>
  );
}
