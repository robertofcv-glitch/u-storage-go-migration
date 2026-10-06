export interface BlogArticle {
  id: string;
  slug: string;
  titleEs: string;
  titleEn: string;
  excerptEs: string;
  excerptEn: string;
  categoryEs: string;
  categoryEn: string;
  author: string;
  date: string;
  readTime: number;
  image: string;
}

export const blogArticles: BlogArticle[] = [
  {
    id: "1",
    slug: "tips-mudanza-exitosa",
    titleEs: "10 Consejos para una Mudanza Exitosa",
    titleEn: "10 Tips for a Successful Move",
    excerptEs: "Planificar una mudanza puede ser abrumador. Descubre los mejores consejos para hacer tu próxima mudanza más fácil y sin estrés.",
    excerptEn: "Planning a move can be overwhelming. Discover the best tips to make your next move easier and stress-free.",
    categoryEs: "Consejos",
    categoryEn: "Tips",
    author: "Equipo U-Storage Go",
    date: "2024-12-01",
    readTime: 5,
    image: "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=800&h=400&fit=crop"
  },
  {
    id: "2",
    slug: "como-empacar-objetos-fragiles",
    titleEs: "Cómo Empacar Objetos Frágiles Correctamente",
    titleEn: "How to Pack Fragile Items Correctly",
    excerptEs: "Aprende las técnicas profesionales para proteger tus objetos más delicados durante el transporte.",
    excerptEn: "Learn professional techniques to protect your most delicate items during transport.",
    categoryEs: "Guías",
    categoryEn: "Guides",
    author: "María González",
    date: "2024-11-25",
    readTime: 7,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop"
  },
  {
    id: "3",
    slug: "elegir-empresa-mudanzas",
    titleEs: "¿Cómo Elegir la Mejor Empresa de Mudanzas?",
    titleEn: "How to Choose the Best Moving Company?",
    excerptEs: "Factores clave a considerar al seleccionar una empresa de mudanzas confiable y profesional.",
    excerptEn: "Key factors to consider when selecting a reliable and professional moving company.",
    categoryEs: "Consejos",
    categoryEn: "Tips",
    author: "Carlos Ramírez",
    date: "2024-11-18",
    readTime: 6,
    image: "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800&h=400&fit=crop"
  },
  {
    id: "4",
    slug: "mudanza-con-mascotas",
    titleEs: "Mudarse con Mascotas: Guía Completa",
    titleEn: "Moving with Pets: Complete Guide",
    excerptEs: "Todo lo que necesitas saber para que tus mascotas tengan una transición tranquila a su nuevo hogar.",
    excerptEn: "Everything you need to know for your pets to have a smooth transition to their new home.",
    categoryEs: "Guías",
    categoryEn: "Guides",
    author: "Ana López",
    date: "2024-11-10",
    readTime: 8,
    image: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&h=400&fit=crop"
  },
  {
    id: "5",
    slug: "reducir-costos-mudanza",
    titleEs: "5 Formas de Reducir los Costos de tu Mudanza",
    titleEn: "5 Ways to Reduce Your Moving Costs",
    excerptEs: "Estrategias inteligentes para ahorrar dinero sin sacrificar la calidad del servicio de mudanza.",
    excerptEn: "Smart strategies to save money without sacrificing the quality of moving service.",
    categoryEs: "Ahorro",
    categoryEn: "Savings",
    author: "Equipo U-Storage Go",
    date: "2024-11-05",
    readTime: 4,
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=400&fit=crop"
  }
];

export const articleContent: Record<string, { es: string; en: string }> = {
  "tips-mudanza-exitosa": {
    es: `
## 1. Planifica con Anticipación

Comienza a planificar tu mudanza al menos 8 semanas antes. Esto te dará tiempo suficiente para organizar todo sin prisas.

## 2. Declutter - Deshaste de lo Innecesario

Antes de empacar, revisa todas tus pertenencias. Dona, vende o desecha lo que ya no necesites. Menos cosas significan menos trabajo y menor costo de mudanza.

## 3. Obtén tu Cotización con Anticipación

Solicita tu cotización con tiempo. Una cotización clara y detallada te permite conocer el precio exacto y los servicios incluidos antes de comprometerte.

## 4. Empaca Habitación por Habitación

Organiza tu empaque por habitaciones. Etiqueta cada caja claramente indicando su contenido y la habitación de destino.

## 5. Prepara un Kit de Esenciales

Prepara una maleta o caja con artículos esenciales que necesitarás los primeros días: documentos importantes, medicamentos, ropa para cambio, cargadores, y artículos de higiene personal.

## 6. Documenta tus Pertenencias

Toma fotos de tus objetos de valor y electrodomésticos antes de la mudanza. Esto te ayudará en caso de cualquier reclamo por daños.

## 7. Notifica el Cambio de Dirección

Actualiza tu dirección con bancos, servicios de suscripción, empleador, y oficinas gubernamentales relevantes.

## 8. Cuida las Mascotas y Plantas

Considera dejar a tus mascotas con amigos o familiares el día de la mudanza. Para plantas, transportalas en tu propio vehículo si es posible.

## 9. Confirma los Detalles

Un día antes de la mudanza, confirma todos los detalles con la empresa: hora de llegada, dirección exacta, y cualquier instrucción especial.

## 10. Mantén la Calma

Las mudanzas pueden ser estresantes, pero con buena planificación todo saldrá bien. Toma descansos cuando los necesites y pide ayuda si la necesitas.
    `,
    en: `
## 1. Plan Ahead

Start planning your move at least 8 weeks in advance. This will give you enough time to organize everything without rushing.

## 2. Declutter

Before packing, go through all your belongings. Donate, sell, or discard what you no longer need. Fewer items mean less work and lower moving costs.

## 3. Get Your Quote Early

Request your quote ahead of time. A clear, detailed quote lets you know the exact price and included services before you commit.

## 4. Pack Room by Room

Organize your packing by rooms. Label each box clearly indicating its contents and destination room.

## 5. Prepare an Essentials Kit

Pack a suitcase or box with essential items you'll need the first few days: important documents, medications, change of clothes, chargers, and personal hygiene items.

## 6. Document Your Belongings

Take photos of your valuables and appliances before the move. This will help you in case of any damage claims.

## 7. Notify Address Change

Update your address with banks, subscription services, employer, and relevant government offices.

## 8. Care for Pets and Plants

Consider leaving your pets with friends or family on moving day. For plants, transport them in your own vehicle if possible.

## 9. Confirm Details

One day before the move, confirm all details with the company: arrival time, exact address, and any special instructions.

## 10. Stay Calm

Moves can be stressful, but with good planning everything will work out. Take breaks when you need them and ask for help if needed.
    `
  },
  "como-empacar-objetos-fragiles": {
    es: `
## Materiales Necesarios

- Papel de embalaje o papel periódico
- Plástico de burbujas
- Cajas de cartón resistente
- Cinta de embalaje
- Marcadores permanentes
- Material de relleno (espuma, cacahuates de embalaje)

## Técnicas de Empaque

### Para Cristalería y Vajilla

1. Envuelve cada pieza individualmente con papel de embalaje
2. Coloca plástico de burbujas adicional para piezas muy delicadas
3. Ubica las piezas verticalmente en la caja, nunca apiladas horizontalmente
4. Rellena todos los espacios vacíos

### Para Electrónicos

1. Si tienes las cajas originales, úsalas
2. Envuelve en plástico de burbujas
3. Protege las pantallas con cartón rígido
4. Guarda cables y accesorios en bolsas etiquetadas

### Para Cuadros y Espejos

1. Forma una X con cinta sobre el vidrio para prevenir roturas
2. Envuelve completamente en plástico de burbujas
3. Usa cajas especiales para cuadros o crea protección con cartón

## Consejos Adicionales

- Nunca sobrecargues las cajas de objetos frágiles
- Marca claramente "FRÁGIL" en todos los lados de la caja
- Indica con flechas la orientación correcta (ESTE LADO ARRIBA)
- Coloca las cajas frágiles encima de otras, nunca debajo
    `,
    en: `
## Required Materials

- Packing paper or newspaper
- Bubble wrap
- Sturdy cardboard boxes
- Packing tape
- Permanent markers
- Filler material (foam, packing peanuts)

## Packing Techniques

### For Glassware and Dishes

1. Wrap each piece individually with packing paper
2. Add extra bubble wrap for very delicate pieces
3. Place pieces vertically in the box, never stacked horizontally
4. Fill all empty spaces

### For Electronics

1. If you have the original boxes, use them
2. Wrap in bubble wrap
3. Protect screens with rigid cardboard
4. Store cables and accessories in labeled bags

### For Paintings and Mirrors

1. Form an X with tape over the glass to prevent breakage
2. Wrap completely in bubble wrap
3. Use special picture boxes or create protection with cardboard

## Additional Tips

- Never overload boxes with fragile items
- Clearly mark "FRAGILE" on all sides of the box
- Indicate correct orientation with arrows (THIS SIDE UP)
- Place fragile boxes on top of others, never underneath
    `
  },
  "elegir-empresa-mudanzas": {
    es: `
## Factores Clave a Considerar

### 1. Licencias y Seguros

Verifica que la empresa tenga todas las licencias necesarias y un seguro adecuado que cubra tus pertenencias durante el transporte.

### 2. Experiencia y Reputación

- Busca reseñas en línea de clientes anteriores
- Pregunta por referencias
- Investiga cuántos años llevan en el negocio

### 3. Cotización Detallada

Una empresa profesional debe proporcionar:
- Inventario detallado de lo que se moverá
- Costo total sin sorpresas
- Desglose de servicios incluidos
- Política de cancelación

### 4. Servicios Ofrecidos

Considera qué servicios necesitas:
- Empaque y desempaque
- Desmontaje y montaje de muebles
- Almacenamiento temporal
- Seguros adicionales

### 5. Proceso de Reclamos

Pregunta sobre su proceso en caso de daños o pérdidas. Una buena empresa tendrá un procedimiento claro y justo.

## Señales de Advertencia

- Cotizaciones por teléfono sin inspección
- Precios significativamente más bajos que la competencia
- Solicitud de depósitos grandes por adelantado
- Falta de dirección física verificable
- No tienen contrato escrito
    `,
    en: `
## Key Factors to Consider

### 1. Licenses and Insurance

Verify that the company has all necessary licenses and adequate insurance covering your belongings during transport.

### 2. Experience and Reputation

- Look for online reviews from previous customers
- Ask for references
- Research how many years they've been in business

### 3. Detailed Quote

A professional company should provide:
- Detailed inventory of what will be moved
- Total cost with no surprises
- Breakdown of included services
- Cancellation policy

### 4. Services Offered

Consider what services you need:
- Packing and unpacking
- Furniture disassembly and assembly
- Temporary storage
- Additional insurance

### 5. Claims Process

Ask about their process in case of damage or loss. A good company will have a clear and fair procedure.

## Warning Signs

- Phone quotes without inspection
- Prices significantly lower than competitors
- Request for large deposits upfront
- No verifiable physical address
- No written contract
    `
  },
  "mudanza-con-mascotas": {
    es: `
## Preparación Antes de la Mudanza

### Actualiza Identificación

- Asegúrate de que las placas tengan tu nueva dirección
- Actualiza el microchip si tu mascota tiene uno
- Lleva registros veterinarios al día

### Visita al Veterinario

- Programa un chequeo antes de la mudanza
- Solicita copia de registros médicos
- Pregunta sobre medicamentos para el estrés si es necesario

## Durante la Mudanza

### Día de la Mudanza

1. Mantén a tu mascota en una habitación tranquila o con un amigo
2. Prepara una bolsa con sus artículos esenciales:
   - Comida y agua para varios días
   - Medicamentos
   - Juguetes favoritos
   - Manta con su olor familiar

### Transporte Seguro

- Usa transportador apropiado para el tamaño
- Nunca dejes mascotas solas en el vehículo
- Realiza paradas frecuentes en viajes largos
- Mantén agua disponible

## En el Nuevo Hogar

### Primeros Días

1. Designa una "habitación segura" con sus cosas familiares
2. Mantén la rutina de alimentación y paseos
3. Presenta gradualmente nuevos espacios
4. Ten paciencia con comportamientos ansiosos

### Señales de Estrés

Observa si tu mascota muestra:
- Cambios en el apetito
- Comportamiento destructivo
- Esconderse excesivamente
- Cambios en hábitos de baño
    `,
    en: `
## Preparation Before Moving

### Update Identification

- Make sure tags have your new address
- Update the microchip if your pet has one
- Keep veterinary records up to date

### Vet Visit

- Schedule a checkup before the move
- Request a copy of medical records
- Ask about stress medication if necessary

## During the Move

### Moving Day

1. Keep your pet in a quiet room or with a friend
2. Prepare a bag with their essential items:
   - Food and water for several days
   - Medications
   - Favorite toys
   - Blanket with their familiar scent

### Safe Transport

- Use an appropriate carrier for their size
- Never leave pets alone in the vehicle
- Make frequent stops on long trips
- Keep water available

## In the New Home

### First Days

1. Designate a "safe room" with their familiar things
2. Maintain feeding and walking routine
3. Gradually introduce new spaces
4. Be patient with anxious behaviors

### Signs of Stress

Watch if your pet shows:
- Changes in appetite
- Destructive behavior
- Excessive hiding
- Changes in bathroom habits
    `
  },
  "reducir-costos-mudanza": {
    es: `
## 1. Elige el Momento Adecuado

### Temporada Baja

Los meses de octubre a abril suelen tener tarifas más bajas. Evita:
- Fin de mes
- Fines de semana
- Temporada de verano

### Flexibilidad de Horario

Si puedes ser flexible con la fecha, podrás negociar mejores precios.

## 2. Reduce lo que Mueves

### Vende o Dona

- Organiza una venta de garage
- Publica artículos en línea
- Dona a organizaciones locales

### Regla del Año

Si no has usado algo en más de un año, probablemente no lo necesites.

## 3. Hazlo Tú Mismo (Parcialmente)

### Opciones de Ahorro

- Empaca tú mismo
- Consigue cajas gratis en supermercados
- Desmonta muebles por tu cuenta
- Limpia el espacio antes de la mudanza

## 4. Compara y Negocia

### Múltiples Cotizaciones

- Solicita al menos 3-5 cotizaciones
- Usa cotizaciones como palanca de negociación
- Pregunta por descuentos disponibles

## 5. Planifica Eficientemente

### Organización

- Ten todo empacado antes de que llegue el equipo
- Etiqueta claramente las cajas
- Asegura estacionamiento para el camión
- Prepara el camino despejado

Cada minuto de trabajo extra cuesta dinero, así que la eficiencia es clave.
    `,
    en: `
## 1. Choose the Right Time

### Off-Season

October through April usually have lower rates. Avoid:
- End of month
- Weekends
- Summer season

### Schedule Flexibility

If you can be flexible with the date, you'll be able to negotiate better prices.

## 2. Reduce What You Move

### Sell or Donate

- Organize a garage sale
- Post items online
- Donate to local organizations

### One-Year Rule

If you haven't used something in over a year, you probably don't need it.

## 3. Do It Yourself (Partially)

### Savings Options

- Pack yourself
- Get free boxes from supermarkets
- Disassemble furniture on your own
- Clean the space before the move

## 4. Compare and Negotiate

### Multiple Quotes

- Request at least 3-5 quotes
- Use quotes as negotiation leverage
- Ask about available discounts

## 5. Plan Efficiently

### Organization

- Have everything packed before the crew arrives
- Clearly label boxes
- Ensure parking for the truck
- Prepare a clear path

Every extra minute of work costs money, so efficiency is key.
    `
  }
};
