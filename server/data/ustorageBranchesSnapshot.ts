// Snapshot of U-Storage branches scraped from https://u-storage.com.mx/sucursales (July 2026).
// Used as seed data; the admin "refresh" action re-scrapes the live site.
import type { InsertUstorageBranch } from "@shared/schema";

export const USTORAGE_BRANCHES_SNAPSHOT: InsertUstorageBranch[] = [
  {
    "externalId": "23",
    "name": "Circuito",
    "region": "CDMX - Centro",
    "url": "https://u-storage.com.mx/circuito/",
    "lat": "19.459827",
    "lng": "-99.161675",
    "priceFromMxn": "1038.83",
    "address": "Avenida Río Consulado 517, Col. Atlampa, Alcaldía Cuauhtémoc, 06450, CDMX, México."
  },
  {
    "externalId": "37",
    "name": "Condesa",
    "region": "CDMX - Centro",
    "url": "https://u-storage.com.mx/condesa/",
    "lat": "19.4151307",
    "lng": "-99.1804565",
    "priceFromMxn": "1547.21",
    "address": "Circuito Interior Maestro José Vasconcelos 169, Col. San Miguel Chapultepec 1a Sección, Alcaldía Miguel Hidalgo, 11850, CDMX, México."
  },
  {
    "externalId": "54",
    "name": "Reforma - Hamburgo",
    "region": "CDMX - Centro",
    "url": "https://u-storage.com.mx/reforma-hamburgo",
    "lat": "19.4235193",
    "lng": "-99.1702055",
    "priceFromMxn": "3521.23",
    "address": "Hamburgo 246, Col. Juárez, Alcaldía Cuauhtémoc, 06600, CDMX, México."
  },
  {
    "externalId": "11",
    "name": "Roma",
    "region": "CDMX - Centro",
    "url": "https://u-storage.com.mx/roma/",
    "lat": "19.4042726",
    "lng": "-99.150875",
    "priceFromMxn": "1530.88",
    "address": "Viad. Pdte. Miguel Alemán 121, Col. Buenos Aires, Alcaldía Cuauhtémoc, 06780, CDMX, México."
  },
  {
    "externalId": "3",
    "name": "Gustavo Baz",
    "region": "CDMX - Norte",
    "url": "https://u-storage.com.mx/gustavo-baz/",
    "lat": "19.5462158",
    "lng": "-99.2030381",
    "priceFromMxn": "1038.83",
    "address": "Calle Antonio M. Rivera 26, Col. Centro Industrial Tlalnepantla, 54030, Municipio de Tlalnepantla, Estado de México, México."
  },
  {
    "externalId": "25",
    "name": "Lindavista",
    "region": "CDMX - Norte",
    "url": "https://u-storage.com.mx/lindavista/",
    "lat": "19.498163",
    "lng": "-99.1559741",
    "priceFromMxn": "2208.53",
    "address": "Calzada Vallejo 1044, Col. Industrial Vallejo, Alcaldía Azcapotzalco, 02300, CDMX, México."
  },
  {
    "externalId": "31",
    "name": "Tepeyac",
    "region": "CDMX - Norte",
    "url": "https://u-storage.com.mx/tepeyac/",
    "lat": "19.467537",
    "lng": "-99.111666",
    "priceFromMxn": "1818.15",
    "address": "Henry Ford 145, Col Bondojito, Alcaldía Gustavo A. Madero, 07850, CDMX, México."
  },
  {
    "externalId": "43",
    "name": "Añil - Granjas México",
    "region": "CDMX - Oriente",
    "url": "https://u-storage.com.mx/anil-granjas-mexico/",
    "lat": "19.40292991949914",
    "lng": "-99.09946537116448",
    "priceFromMxn": "3492.92",
    "address": "Añil 485, Col Granjas México, Alcaldía Iztacalco, 08400, CDMX, México."
  },
  {
    "externalId": "27",
    "name": "Churubusco",
    "region": "CDMX - Oriente",
    "url": "https://u-storage.com.mx/churubusco/",
    "lat": "19.3803454",
    "lng": "-99.0875934",
    "priceFromMxn": "2386.40",
    "address": "Avenida Leyes de Reforma (Eje 5 Sur) 54, Col. Parques de Churubusco, Alcaldía Iztapalapa, 09040, CDMX, México."
  },
  {
    "externalId": "9",
    "name": "Viaducto",
    "region": "CDMX - Oriente",
    "url": "https://u-storage.com.mx/viaducto/",
    "lat": "19.406443",
    "lng": "-99.1087337",
    "priceFromMxn": "3372.73",
    "address": "Viad. Río de la Piedad 571, Col. Granjas México, Alcaldía Iztacalco, 08400, CDMX, México."
  },
  {
    "externalId": "32",
    "name": "Anzures – Polanco",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/anzures-polanco/",
    "lat": "19.43489",
    "lng": "-99.172603",
    "priceFromMxn": "1508.00",
    "address": "Bahía de Santa Bárbara 171, Col. Verónica Anzures, Alcaldía Miguel Hidalgo,11300, CDMX, México."
  },
  {
    "externalId": "10",
    "name": "Cuajimalpa - Santa Fe",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/cuajimalpa-santa-fe/",
    "lat": "19.365032",
    "lng": "-99.274296",
    "priceFromMxn": "1425.71",
    "address": "Carr. México - Toluca 5214, Col. La Rosita - El Yaqui, Alcaldía Cuajimalpa, 05340, CDMX, México."
  },
  {
    "externalId": "33",
    "name": "Interlomas",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/interlomas/",
    "lat": "19.407555",
    "lng": "-99.276337",
    "priceFromMxn": "1114.92",
    "address": "Av. Palo Solo 101-B, Col. Centro Urbano San Fernando La Herradura, Municipio de Huixquilucan, 52787, Estado de México, México."
  },
  {
    "externalId": "38",
    "name": "Mariano Escobedo",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/mariano-escobedo/",
    "lat": "19.4536634",
    "lng": "-99.1817288",
    "priceFromMxn": "798.00",
    "address": "Calz. Gral. Mariano Escobedo 43, Col. Popotla, Alcaldía Miguel Hidalgo, 11400, CDMX, México."
  },
  {
    "externalId": "7",
    "name": "México - Tacuba",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/mexico-tacuba/",
    "lat": "19.4553619",
    "lng": "-99.1786469",
    "priceFromMxn": "828.23",
    "address": "Calzada México - Tacuba 501, Col. Popotla, Alcaldía Miguel Hidalgo, 11400, CDMX, México."
  },
  {
    "externalId": "28",
    "name": "Parques Polanco",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/parques-polanco/",
    "lat": "19.441002",
    "lng": "-99.185333",
    "priceFromMxn": "1698.84",
    "address": "Lago Alberto 320 - Sótano, Col. Granada, Alcaldía Miguel Hidalgo, 11520, CDMX, México."
  },
  {
    "externalId": "34",
    "name": "Paseo Interlomas",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/paseo-interlomas/",
    "lat": "19.397578199999785",
    "lng": "-99.28238205380242",
    "priceFromMxn": "3479.22",
    "address": "Vialidad de la Barranca 6, Col. Ex Hacienda Jesús del Monte, Valle de las Palmas, 52787, Municipio de Naucalpan de Juárez, Estado de México, México."
  },
  {
    "externalId": "20",
    "name": "Periférico Toreo",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/periferico-toreo/",
    "lat": "19.4551164",
    "lng": "-99.2223211",
    "priceFromMxn": "752.63",
    "address": "Blvrd. Manuel Ávila Camacho 60, Col. El Parque, Municipio de Naucalpan de Juárez, 53398, Estado de México, México."
  },
  {
    "externalId": "1",
    "name": "Polanco",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/polanco/",
    "lat": "19.440863",
    "lng": "-99.191605",
    "priceFromMxn": "1225.79",
    "address": "Blvd. Miguel de Cervantes Saavedra 5, Col. Granada, Alcaldía Miguel Hidalgo, 11520, CDMX, México."
  },
  {
    "externalId": "39",
    "name": "Río San Joaquín",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/rio-san-joaquin-granada/",
    "lat": "19.4452473",
    "lng": "-99.2005921",
    "priceFromMxn": "1614.60",
    "address": "C. Lago Chairel 201, Col. Popo, Alcaldía Miguel Hidalgo, 11480, CDMX, México."
  },
  {
    "externalId": "8",
    "name": "Santa Fe",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/santa-fe/",
    "lat": "19.3799981",
    "lng": "-99.2487798",
    "priceFromMxn": "1889.55",
    "address": "Gómez Farías 49, Col. Santa Fé, Alcaldía Álvaro Obregón, 01320, CDMX, México."
  },
  {
    "externalId": "12",
    "name": "Santa Fe - Vasco de Quiroga",
    "region": "CDMX - Poniente",
    "url": "https://u-storage.com.mx/santa-fe-vasco-de-quiroga/",
    "lat": "19.3802539",
    "lng": "-99.2435173",
    "priceFromMxn": "1957.50",
    "address": "Av. Vasco de Quiroga 1832, Col. Santa Fé, Alcaldía Álvaro Obregón, 01210, CDMX, México."
  },
  {
    "externalId": "29",
    "name": "Av. del Imán",
    "region": "CDMX - Sur",
    "url": "https://u-storage.com.mx/av-del-iman/",
    "lat": "19.3075425",
    "lng": "-99.1633595",
    "priceFromMxn": "882.00",
    "address": "Av. del Imán 1, Col. Pedregal de Carrasco, Alcaldía Coyoacán, 04700, CDMX, México."
  },
  {
    "externalId": "53",
    "name": "Calzada del Hueso - Anáhuac",
    "region": "CDMX - Sur",
    "url": "https://u-storage.com.mx/calzada-del-hueso-anahuac",
    "lat": "19.302468745967328",
    "lng": "-99.10975024233022",
    "priceFromMxn": "1313.52",
    "address": "Anáhuac 84, Col. El Mirador, Alcaldía Coyoacán, 04950, CDMX, México."
  },
  {
    "externalId": "22",
    "name": "Del Valle",
    "region": "CDMX - Sur",
    "url": "https://u-storage.com.mx/del-valle/",
    "lat": "19.3641126",
    "lng": "-99.1691433",
    "priceFromMxn": "6922.44",
    "address": "Mayorazgo de Solís 46, Col. Xoco, Alcaldía Benito Juárez, 03330, CDMX, México."
  },
  {
    "externalId": "40",
    "name": "Insurgentes Sur",
    "region": "CDMX - Sur",
    "url": "https://u-storage.com.mx/insurgentes-guadalupe/",
    "lat": "19.356288169279075",
    "lng": "-99.18492968203698",
    "priceFromMxn": "2811.06",
    "address": "Av. Insurgentes Sur 1831, Col. Guadalupe Inn, Alcaldía Álvaro Obregón, 01020, CDMX, México."
  },
  {
    "externalId": "35",
    "name": "Narvarte",
    "region": "CDMX - Sur",
    "url": "https://u-storage.com.mx/narvarte/",
    "lat": "19.384173",
    "lng": "-99.1510112",
    "priceFromMxn": "6426.00",
    "address": "Eugenia 1664, Col. Narvarte Poniente, Alcaldía Benito Juárez, 03020, CDMX, México."
  },
  {
    "externalId": "55",
    "name": "Periférico Pedregal",
    "region": "CDMX - Sur",
    "url": "periferico-pedregal",
    "lat": "19.3161383",
    "lng": "-99.2211867",
    "priceFromMxn": null,
    "address": null
  },
  {
    "externalId": "21",
    "name": "Periférico San Antonio",
    "region": "CDMX - Sur",
    "url": "https://u-storage.com.mx/periferico-san-antonio/",
    "lat": "19.3928845",
    "lng": "-99.1889831",
    "priceFromMxn": "745.88",
    "address": "Blvd. Adolfo López Mateos 160, Col. San Pedro de los Pinos, Alcaldía Álvaro Obregón, 01180, CDMX, México."
  },
  {
    "externalId": "6",
    "name": "Prolongación San Antonio",
    "region": "CDMX - Sur",
    "url": "https://u-storage.com.mx/prolongacion-san-antonio/",
    "lat": "19.3840911",
    "lng": "-99.19732",
    "priceFromMxn": "871.50",
    "address": "Prolongación San Antonio 137, Col. Carola, Alcaldía Álvaro Obregón, 01180, CDMX, México."
  },
  {
    "externalId": "30",
    "name": "Revolución",
    "region": "CDMX - Sur",
    "url": "https://u-storage.com.mx/revolucion/",
    "lat": "19.370424",
    "lng": "-99.187851",
    "priceFromMxn": "5420.25",
    "address": "Avenida Revolución 998, Col. San José Insurgentes, Alcaldía Benito Juárez, 03900, CDMX, México."
  },
  {
    "externalId": "2",
    "name": "Tlalpan 949",
    "region": "CDMX - Sur",
    "url": "https://u-storage.com.mx/tlalpan-949/",
    "lat": "19.3851538",
    "lng": "-99.1419936",
    "priceFromMxn": "2459.20",
    "address": "Calzada de Tlalpan 949, Col. Niños Héroes, Alcaldía Benito Juárez, 03440, CDMX, México."
  },
  {
    "externalId": "13",
    "name": "Tlalpan Coapa",
    "region": "CDMX - Sur",
    "url": "https://u-storage.com.mx/tlalpan-coapa/",
    "lat": "19.317804",
    "lng": "-99.137871",
    "priceFromMxn": "1406.25",
    "address": "Av. División del Norte 3670, Col. Espartaco, Alcaldía Coyoacán, 04870, CDMX, México."
  },
  {
    "externalId": "19",
    "name": "Universidad",
    "region": "CDMX - Sur",
    "url": "https://u-storage.com.mx/universidad/",
    "lat": "19.3416691",
    "lng": "-99.1846555",
    "priceFromMxn": "8425.20",
    "address": "Cerro Tuera 26, Col. Copilco Universidad, Alcaldía Coyoacán, 04360, CDMX, México."
  },
  {
    "externalId": "24",
    "name": "Acapulco",
    "region": "Todo México",
    "url": "https://u-storage.com.mx/acapulco/",
    "lat": "16.76636",
    "lng": "-99.764073",
    "priceFromMxn": "286.00",
    "address": "Boulevard de las Naciones 281, Col. Parque Ecológico Viveristas, 39893, Acapulco, Guerrero, México."
  },
  {
    "externalId": "4",
    "name": "Lerma",
    "region": "Todo México",
    "url": "https://u-storage.com.mx/lerma/",
    "lat": "19.2826969",
    "lng": "-99.483494",
    "priceFromMxn": "1007.00",
    "address": "Carretera México - Toluca Km 46.5, Col. Amomolulco Toluca, Municipio de Ocoyoacac, 52740, Estado de México, México."
  },
  {
    "externalId": "42",
    "name": "Lerma Outlet",
    "region": "Todo México",
    "url": "https://u-storage.com.mx/lerma-estado-de-mexico/",
    "lat": "19.281466229150293",
    "lng": "-99.49428149384589",
    "priceFromMxn": "1836.45",
    "address": "Carretera Toluca - México Km 48, Col. San Antonio el Llanito, Ocoyoacac, 52000, Lerma de Villada, Estado de México, México."
  },
  {
    "externalId": "16",
    "name": "Puebla",
    "region": "Todo México",
    "url": "https://u-storage.com.mx/puebla/",
    "lat": "19.036659",
    "lng": "-98.251552",
    "priceFromMxn": "1080.15",
    "address": "Carretera Federal Atlixco - Puebla Km. 3.5, Col. Concepción de la Cruz, 72197, San Andrés Cholula, Puebla, México."
  },
  {
    "externalId": "15",
    "name": "Querétaro",
    "region": "Todo México",
    "url": "https://u-storage.com.mx/queretaro/",
    "lat": "20.5856581",
    "lng": "-100.3811266",
    "priceFromMxn": "445.50",
    "address": "Av. Constituyentes 40, Sótano 2, Col. Villas del Sol, 76040, Santiago de Querétaro, Querétaro, México."
  }
];
