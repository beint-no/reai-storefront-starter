// Edit this file for each store. ReAI supplies the store name, market, and catalog.
// Review policy copy and add the merchant's public details before launch.
export const storeContent = {
  contactEmail: "",
  legalName: "",
  organizationNumber: "",
  address: "",
  newsletterEnabled: true,
  // Enable only after configuring the merchant's ReAI back-in-stock flow.
  stockNotificationsEnabled: false,
  nb: {
    tagline: "Se utvalget og finn det du trenger.",
    heroEyebrow: "Velkommen til butikken",
    heroTitle: "Utforsk vårt utvalg.",
    heroDescription: "Se produkter og priser, velg variant og bestill på nett.",
    aboutIntro:
      "Se gjennom sortimentet vårt. Ta kontakt hvis du trenger hjelp til å velge.",
    pages: {
      about: {
        title: "Om oss",
        eyebrow: "Historien vår",
        lead: "En butikk for tingene du bruker, setter pris på og gjerne deler med andre.",
        sections: [
          [
            "Velkommen til {name}",
            "Vi samler produkter med omtanke for kvalitet, nytte og varig verdi. Utforsk utvalget og finn noe som passer for deg.",
          ],
          [
            "Vårt utvalg",
            "Sortimentet endrer seg når nye produkter kommer inn. Se gjennom butikken for å finne det som er tilgjengelig nå.",
          ],
        ],
      },
      contact: {
        title: "Kontakt oss",
        eyebrow: "Vi hjelper deg",
        lead: "Har du spørsmål om et produkt eller en ordre? Ta gjerne kontakt.",
        sections: [
          [
            "Ta kontakt",
            "Kontakt oss på {contact}. Oppgi gjerne ordrenummeret hvis spørsmålet gjelder en bestilling.",
          ],
          [
            "Levering og retur",
            "Du finner mer informasjon om levering og retur på sidene under.",
          ],
        ],
      },
      shipping: {
        title: "Frakt og levering",
        eyebrow: "Din bestilling",
        lead: "Leveringsvalg og priser vises før du bestiller.",
        sections: [
          [
            "Levering i kassen",
            "Oppgi leveringsadressen i kassen for å se tilgjengelige fraktalternativer og den totale prisen. Tilgjengelighet og leveringstid avhenger av hvor varen skal sendes og valgt leveringsmåte.",
          ],
          [
            "Trenger du hjelp?",
            "Kontakt {contact} og oppgi ordrenummeret hvis du har spørsmål om en levering.",
          ],
        ],
      },
      faq: {
        title: "Ofte stilte spørsmål",
        eyebrow: "Greit å vite",
        lead: "Svar på vanlige spørsmål om å handle hos oss.",
        sections: [
          [
            "Hvordan bestiller jeg?",
            "Legg et produkt i handlekurven, se over bestillingen og gå videre til sikker betaling.",
          ],
          [
            "Når ser jeg fraktkostnaden?",
            "Tilgjengelige leveringsmåter og priser vises i kassen før du betaler.",
          ],
          [
            "Kan jeg endre eller returnere en ordre?",
            "Kontakt {contact} så snart som mulig. Se retursiden for mer informasjon.",
          ],
        ],
      },
      returns: {
        title: "Retur",
        eyebrow: "Etter kjøpet",
        lead: "Ta kontakt hvis noe ikke stemmer med bestillingen din.",
        sections: [
          [
            "Be om retur",
            "Kontakt {contact} med ordrenummer, hvilket produkt det gjelder og årsaken til henvendelsen før du sender noe tilbake. Vi forklarer veien videre og eventuelle kostnader.",
          ],
          [
            "Dine rettigheter",
            "Dine lovfestede forbrukerrettigheter gjelder uansett.",
          ],
        ],
      },
      privacy: {
        title: "Personvern",
        eyebrow: "Dine opplysninger",
        lead: "Vi bruker opplysningene du gir oss for å behandle og levere bestillingen din.",
        sections: [
          [
            "Bestillingsopplysninger",
            "Kassen innhenter kontakt-, leverings- og betalingsopplysninger som trengs for å gjennomføre kjøpet. Betalingen håndteres i ReAIs betalingsløsning. Kontakt {contact} hvis du har spørsmål om personopplysningene dine.",
          ],
          [
            "Nyhetsbrev og handlekurv",
            "Hvis du melder deg på nyhetsbrevet, lagrer vi e-postadressen og samtykket ditt i ReAI. Kontakt {contact} for å trekke tilbake samtykket. Handlekurven lagres lokalt i nettleseren din. Påmelding er frivillig og er ikke nødvendig for å handle.",
          ],
        ],
      },
      terms: {
        title: "Kjøpsvilkår",
        eyebrow: "Før du bestiller",
        lead: "Se over produkter, levering og totalsum før du bekrefter betalingen.",
        sections: [
          [
            "Priser og betaling",
            "Produktprisene vises i butikkens valuta. Sluttsummen, inkludert eventuell frakt, vises i kassen før du betaler.",
          ],
          [
            "Spørsmål",
            "Kontakt {contact} hvis du har spørsmål om en bestilling.",
          ],
        ],
      },
    },
  },
  en: {
    tagline: "Browse the range and find what you need.",
    heroEyebrow: "Welcome to the store",
    heroTitle: "Explore our range.",
    heroDescription:
      "Browse products and prices, choose an option, and order online.",
    aboutIntro: "Explore our range. Get in touch if you need help choosing.",
    pages: {
      about: {
        title: "About us",
        eyebrow: "The story",
        lead: "A store for the things you reach for, return to, and love to share.",
        sections: [
          [
            "Welcome to {name}",
            "We bring together products with an eye for quality, usefulness, and enduring appeal. Explore the collection and find something that feels right for you.",
          ],
          [
            "Our selection",
            "Our selection changes as new products arrive. Browse the store to see what is available today.",
          ],
        ],
      },
      contact: {
        title: "Contact us",
        eyebrow: "We're here to help",
        lead: "Have a question about a product or an order? We would love to hear from you.",
        sections: [
          [
            "Get in touch",
            "Contact us at {contact}. Include your order number if your question concerns an order.",
          ],
          [
            "Delivery and returns",
            "You can find more information about delivery and returns on the pages below.",
          ],
        ],
      },
      shipping: {
        title: "Shipping & delivery",
        eyebrow: "Your order",
        lead: "Delivery choices and their prices are shown before you place an order.",
        sections: [
          [
            "Delivery at checkout",
            "Enter your delivery details during checkout to see the available shipping methods and the total cost for your order. Availability and delivery times depend on the destination and the selected method.",
          ],
          [
            "Need help?",
            "Contact {contact} and include your order number if you have questions about a delivery.",
          ],
        ],
      },
      faq: {
        title: "Frequently asked questions",
        eyebrow: "Good to know",
        lead: "Answers to common questions about shopping with us.",
        sections: [
          [
            "How do I place an order?",
            "Add a product to your cart, review it, and continue to secure checkout.",
          ],
          [
            "When will I see shipping costs?",
            "Available delivery methods and their prices are shown during checkout, before you pay.",
          ],
          [
            "Can I change or return an order?",
            "Contact {contact} as soon as possible. See the returns page for more information.",
          ],
        ],
      },
      returns: {
        title: "Returns",
        eyebrow: "After your purchase",
        lead: "If something is not right with your order, please get in touch.",
        sections: [
          [
            "Request a return",
            "Contact {contact} with your order number, the item concerned, and the reason for your request before sending anything back. We will explain the next steps and applicable costs.",
          ],
          ["Your rights", "Your statutory consumer rights remain unaffected."],
        ],
      },
      privacy: {
        title: "Privacy",
        eyebrow: "Your information",
        lead: "We use the information you provide to process and deliver your order.",
        sections: [
          [
            "Order information",
            "Checkout collects the contact, delivery, and payment information needed to complete your purchase. Payment is handled on ReAI's hosted checkout. Contact {contact} for questions about your personal information.",
          ],
          [
            "Newsletter and cart",
            "If you subscribe, we store your email address and consent in ReAI. Contact {contact} to withdraw consent. Your cart is stored locally in your browser. Newsletter signup is optional and is not required to shop.",
          ],
        ],
      },
      terms: {
        title: "Terms of sale",
        eyebrow: "Before you order",
        lead: "Review your products, delivery choice, and total before confirming payment.",
        sections: [
          [
            "Prices and payment",
            "Product prices appear in the store's selected currency. The final total, including any delivery cost, is shown during checkout before you pay.",
          ],
          [
            "Questions",
            "Contact {contact} if you have questions about an order.",
          ],
        ],
      },
    },
  },
};
