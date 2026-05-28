import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

loadEnvConfig(process.cwd());

const db = new PrismaClient();

const indiaGeo = {
  Maharashtra: {
    slug: "maharashtra",
    cities: {
      Mumbai: ["Andheri", "Bandra", "Juhu", "Powai", "Worli", "Colaba"],
      Pune: ["Koregaon Park", "Kalyani Nagar", "Baner", "Hinjewadi", "Viman Nagar"],
    },
  },
  Delhi: {
    slug: "delhi",
    cities: {
      Delhi: ["Connaught Place", "Saket", "Dwarka", "Rohini", "Karol Bagh", "Hauz Khas"],
    },
  },
  Karnataka: {
    slug: "karnataka",
    cities: {
      Bangalore: ["Koramangala", "Indiranagar", "Whitefield", "MG Road", "Jayanagar"],
    },
  },
  Telangana: {
    slug: "telangana",
    cities: {
      Hyderabad: ["Banjara Hills", "Jubilee Hills", "Gachibowli", "Hitech City", "Secunderabad"],
    },
  },
  Goa: {
    slug: "goa",
    cities: {
      Panaji: ["Miramar", "Dona Paula", "Calangute", "Baga", "Anjuna"],
    },
  },
} as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const country = await db.country.upsert({
    where: { code: "IN" },
    update: {
      name: "India",
      slug: "india",
      isActive: true,
    },
    create: {
      name: "India",
      code: "IN",
      slug: "india",
      isActive: true,
    },
  });

  let states = 0;
  let cities = 0;
  let areas = 0;

  for (const [stateName, stateData] of Object.entries(indiaGeo)) {
    const state = await db.state.upsert({
      where: {
        slug_countryId: {
          slug: stateData.slug,
          countryId: country.id,
        },
      },
      update: {
        name: stateName,
        isActive: true,
      },
      create: {
        name: stateName,
        slug: stateData.slug,
        countryId: country.id,
        isActive: true,
      },
    });
    states += 1;

    for (const [cityName, areaNames] of Object.entries(stateData.cities)) {
      const city = await db.city.upsert({
        where: {
          slug_stateId: {
            slug: slugify(cityName),
            stateId: state.id,
          },
        },
        update: {
          name: cityName,
          isActive: true,
          isFeatured: true,
        },
        create: {
          name: cityName,
          slug: slugify(cityName),
          stateId: state.id,
          isActive: true,
          isFeatured: true,
        },
      });
      cities += 1;

      for (const areaName of areaNames) {
        await db.area.upsert({
          where: {
            slug_cityId: {
              slug: slugify(areaName),
              cityId: city.id,
            },
          },
          update: {
            name: areaName,
            isActive: true,
          },
          create: {
            name: areaName,
            slug: slugify(areaName),
            cityId: city.id,
            isActive: true,
          },
        });
        areas += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        message: "India geo seed complete",
        country: country.name,
        states,
        cities,
        areas,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
