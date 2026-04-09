import { contactData } from "@/src/lib/constants";

export default function ContatoPage() {
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
            Fale Conosco
          </h1>
          <p
            className="text-lg leading-relaxed"
            style={{ color: "var(--color-neutral-dark)", opacity: 0.75 }}
          >
            Estamos aqui para ajudar. Entre em contato pelos canais abaixo ou
            preencha o formulário.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-10 mb-16">
          {/* Contact info */}
          <div className="flex flex-col gap-6">
            <h2
              className="text-xl font-semibold"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-neutral-dark)",
              }}
            >
              Atendimento
            </h2>

            {/* WhatsApp */}
            <a
              href={`https://wa.me/${contactData.whatsapp}?text=Ol%C3%A1!%20Estou%20olhando%20o%20site%20e%20gostaria%20de%20algumas%20informa%C3%A7%C3%B5es`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-6 py-4 rounded-3xl font-medium transition-all duration-300 hover:-translate-y-0.5 shadow-sm hover:shadow-md"
              style={{
                backgroundColor: "#25D366",
                color: "#fff",
                fontFamily: "var(--font-body)",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5 shrink-0"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp: {contactData.phone}
            </a>

            {/* Phone */}
            <a
              href={`tel:${contactData.phoneTel}`}
              className="flex items-center gap-3 px-6 py-4 rounded-3xl font-medium transition-all duration-300 hover:-translate-y-0.5 border"
              style={{
                borderColor: "var(--color-secondary)",
                color: "var(--color-neutral-dark)",
                fontFamily: "var(--font-body)",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 shrink-0"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                />
              </svg>
              Telefone: {contactData.phone}
            </a>

            {/* Social media */}
            <div className="flex gap-4 mt-2">
              {[
                { href: contactData.instagram, label: "Instagram" },
                { href: contactData.facebook, label: "Facebook" },
                { href: contactData.youtube, label: "YouTube" },
              ].map(({ href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-3xl text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 border"
                  style={{
                    borderColor: "var(--color-neutral-mid)",
                    color: "var(--color-neutral-dark)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Contact form */}
          <div>
            <h2
              className="text-xl font-semibold mb-6"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-neutral-dark)",
              }}
            >
              Envie uma mensagem
            </h2>
            <form action="" className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--color-neutral-dark)" }}
                >
                  Nome
                </label>
                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  required
                  placeholder="Seu nome"
                  className="w-full px-4 py-3 rounded-2xl border outline-none transition-all duration-300"
                  style={{
                    borderColor: "var(--color-neutral-mid)",
                    backgroundColor: "var(--color-neutral-light)",
                    color: "var(--color-neutral-dark)",
                    fontFamily: "var(--font-body)",
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--color-neutral-dark)" }}
                >
                  E-mail
                </label>
                <input
                  id="contact-email"
                  type="email"
                  name="email"
                  required
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 rounded-2xl border outline-none transition-all duration-300"
                  style={{
                    borderColor: "var(--color-neutral-mid)",
                    backgroundColor: "var(--color-neutral-light)",
                    color: "var(--color-neutral-dark)",
                    fontFamily: "var(--font-body)",
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="contact-message"
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--color-neutral-dark)" }}
                >
                  Mensagem
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Como podemos ajudar?"
                  className="w-full px-4 py-3 rounded-2xl border outline-none transition-all duration-300 resize-none"
                  style={{
                    borderColor: "var(--color-neutral-mid)",
                    backgroundColor: "var(--color-neutral-light)",
                    color: "var(--color-neutral-dark)",
                    fontFamily: "var(--font-body)",
                  }}
                />
              </div>
              <button
                type="submit"
                className="w-full px-8 py-4 rounded-3xl font-medium transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-neutral-dark)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Enviar mensagem
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
