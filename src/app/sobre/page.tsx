import Link from "next/link";

const VALUES = [
  {
    title: "Artesanal",
    description:
      "Cada peça é criada com cuidado e atenção aos detalhes. Valorizamos as mãos que costuram, os tecidos que respiram e a história por trás de cada ponto.",
  },
  {
    title: "Versátil",
    description:
      "Desenvolvemos roupas que se adaptam à vida real — do dia a dia ao momento especial. Uma peça, várias histórias.",
  },
  {
    title: "Sustentável",
    description:
      "Acreditamos em um consumo mais consciente. Por isso, produzimos em pequenas coleções, priorizando materiais responsáveis e processos éticos.",
  },
];

export default function SobrePage() {
  return (
    <div className="container-luratha section-padding">
      {/* Hero */}
      <div className="max-w-3xl mx-auto text-center mb-16">
        <h1 className="mb-6">Nossa História</h1>
        <p className="text-lg leading-relaxed text-[var(--color-neutral-dark)]/80">
          A Luratha nasceu do amor por peças que duram e contam histórias. Somos
          uma marca de moda feminina artesanal brasileira, comprometida com a
          beleza intencional e o consumo consciente.
        </p>
      </div>

      {/* Values */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        {VALUES.map(({ title, description }) => (
          <div
            key={title}
            className="bg-[var(--color-accent)] rounded-3xl p-8 flex flex-col gap-4"
          >
            <h3>{title}</h3>
            <p className="leading-relaxed text-[var(--color-neutral-dark)]/75">
              {description}
            </p>
          </div>
        ))}
      </div>

      {/* Manifesto */}
      <div className="max-w-2xl mx-auto bg-[var(--color-primary)] rounded-3xl p-10 text-center">
        <h2 className="mb-6">Nosso Manifesto</h2>
        <p className="leading-relaxed mb-4 text-[var(--color-neutral-dark)]/85">
          Acreditamos que a moda pode ser um ato de amor — amor a si mesma, ao
          trabalho artesanal e ao planeta. Na Luratha, cada peça é pensada para
          ser especial no dia em que você a usa e anos depois.
        </p>
        <p className="leading-relaxed text-[var(--color-neutral-dark)]/85">
          Fazemos slow fashion de verdade: menos coleções, mais significado.
          Somos feitas no Brasil, com orgulho e com carinho.
        </p>
      </div>

      {/* CTA */}
      <div className="mt-12 text-center">
        <Link
          href="/contato"
          className="inline-block px-8 py-4 rounded-3xl font-medium transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 bg-[var(--color-primary)] text-[var(--color-neutral-dark)]"
        >
          Fale conosco
        </Link>
      </div>
    </div>
  );
}

