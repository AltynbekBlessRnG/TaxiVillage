// Засевает справочник мест из OpenStreetMap.
//
// Коммерческие карты про Ушарал почти ничего не знают, зато в OSM размечены
// улицы и часть заведений. Это стартовый набор: дальше справочник наполняется
// руками через админку и тем, чего в открытых картах нет — «старая баня»,
// «у мечети».
//
// Запуск (bbox по умолчанию — Ушарал):
//   node scripts/with-env.js node scripts/seed-places.js
//   node scripts/seed-places.js --bbox=46.13,80.88,46.22,80.99
//   node scripts/seed-places.js --dry-run
//
// Повторный запуск не плодит дубли: место опознаётся по externalId.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_BBOX = [46.13, 80.88, 46.22, 80.99];
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const bboxArg = args.find((value) => value.startsWith('--bbox='));
  const bbox = bboxArg
    ? bboxArg.slice('--bbox='.length).split(',').map(Number)
    : DEFAULT_BBOX;

  if (bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) {
    throw new Error('--bbox ждёт четыре числа: south,west,north,east');
  }

  const fileArg = args.find((value) => value.startsWith('--file='));

  return {
    bbox,
    dryRun: args.includes('--dry-run'),
    // Overpass ограничивает частоту запросов, поэтому ответ можно сохранить
    // один раз и засевать из файла — полезно и для повторяемости.
    file: fileArg ? fileArg.slice('--file='.length) : null,
  };
}

async function fetchOverpass(bbox) {
  const [south, west, north, east] = bbox;
  const query =
    `[out:json][timeout:60];(` +
    `node["name"](${south},${west},${north},${east});` +
    `way["name"](${south},${west},${north},${east});` +
    `);out center tags;`;

  let lastError;
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass отвечает 406 на запрос без User-Agent.
          'User-Agent': 'ZhetysuGo-place-seeder/1.0 (+https://github.com/AltynbekBlessRnG/TaxiVillage)',
        },
        body: new URLSearchParams({ data: query }).toString(),
      });
      if (!response.ok) {
        throw new Error(`${endpoint} ответил ${response.status}`);
      }
      const text = await response.text();
      // Перегруженный Overpass отвечает страницей об ошибке со статусом 200.
      if (!text.trimStart().startsWith('{')) {
        throw new Error(`${endpoint} вернул не JSON (скорее всего лимит)`);
      }
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      process.stderr.write(`${error.message}, пробую следующее зеркало\n`);
    }
  }

  throw lastError ?? new Error('Не удалось получить данные Overpass');
}

/** Решает, ориентир это, улица или местность — и какой категории. */
function classify(tags) {
  if (tags.highway) {
    // Тропинки и служебные проезды названиями не помогают.
    const useful = ['residential', 'unclassified', 'tertiary', 'secondary', 'primary', 'trunk', 'living_street', 'road'];
    return useful.includes(tags.highway) ? { kind: 'STREET', category: tags.highway } : null;
  }
  if (tags.place) {
    return { kind: 'AREA', category: tags.place };
  }
  if (tags.shop) {
    return { kind: 'POI', category: `shop:${tags.shop}` };
  }
  if (tags.amenity) {
    return { kind: 'POI', category: `amenity:${tags.amenity}` };
  }
  if (tags.office) {
    return { kind: 'POI', category: `office:${tags.office}` };
  }
  if (tags.tourism) {
    return { kind: 'POI', category: `tourism:${tags.tourism}` };
  }
  if (tags.leisure) {
    return { kind: 'POI', category: `leisure:${tags.leisure}` };
  }
  if (tags.healthcare) {
    return { kind: 'POI', category: `healthcare:${tags.healthcare}` };
  }
  return null;
}

/** Как это место ещё называют: другие языки OSM и написание в нижнем регистре. */
function buildAliases(tags, name) {
  const raw = [tags['name:ru'], tags['name:kk'], tags['name:en'], tags.alt_name, tags.old_name];
  const aliases = new Set();
  for (const value of raw) {
    if (typeof value === 'string' && value.trim() && value.trim() !== name) {
      aliases.add(value.trim());
    }
  }
  aliases.add(name.toLowerCase());
  aliases.delete(name);
  return Array.from(aliases);
}

async function main() {
  const { bbox, dryRun, file } = parseArgs();

  let data;
  if (file) {
    process.stdout.write(`Читаю сохранённый ответ OSM: ${file}\n`);
    data = JSON.parse(require('fs').readFileSync(file, 'utf8'));
  } else {
    process.stdout.write(`Запрашиваю OSM по bbox ${bbox.join(',')}...\n`);
    data = await fetchOverpass(bbox);
  }
  const elements = data.elements || [];

  const places = [];
  const seen = new Set();
  for (const element of elements) {
    const tags = element.tags || {};
    const name = typeof tags.name === 'string' ? tags.name.trim() : '';
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }

    const classified = classify(tags);
    if (!classified) {
      continue;
    }

    const externalId = `${element.type}/${element.id}`;
    if (seen.has(externalId)) {
      continue;
    }
    seen.add(externalId);

    places.push({
      name,
      aliases: buildAliases(tags, name),
      kind: classified.kind,
      category: classified.category,
      lat,
      lng,
      source: 'OSM',
      externalId,
    });
  }

  const counts = places.reduce((acc, place) => {
    acc[place.kind] = (acc[place.kind] || 0) + 1;
    return acc;
  }, {});
  process.stdout.write(`Пригодных объектов: ${places.length} ${JSON.stringify(counts)}\n`);

  if (dryRun) {
    process.stdout.write('--dry-run: в базу ничего не пишу.\n');
    process.stdout.write(`${JSON.stringify(places.slice(0, 10), null, 2)}\n`);
    return;
  }

  let created = 0;
  let updated = 0;
  for (const place of places) {
    const existing = await prisma.place.findUnique({
      where: { externalId: place.externalId },
      select: { id: true },
    });

    if (existing) {
      // Имя и координаты в OSM обновляются, но isActive и правки админа - нет:
      // если место отключили руками, повторный сид не должен его воскрешать.
      await prisma.place.update({
        where: { externalId: place.externalId },
        data: {
          name: place.name,
          aliases: place.aliases,
          kind: place.kind,
          category: place.category,
          lat: place.lat,
          lng: place.lng,
        },
      });
      updated += 1;
    } else {
      await prisma.place.create({ data: place });
      created += 1;
    }
  }

  process.stdout.write(
    `${JSON.stringify({ ok: true, created, updated, total: places.length })}\n`,
  );
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
