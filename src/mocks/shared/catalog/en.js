// English names of the catalog (fabrics, fabric tags, product categories / colours / products, calculator
// templates, kit sizes, options, warehouses, pricelists, order sources) – the English version of both demos
// (workspace CLAUDE.md, step 10). The seed itself stays Ukrainian; the mocks translate names when they answer
// in English (`localizeCatalogText`). Identical in both repos, like the rest of this folder.
//
// Names are translated phrase by phrase, longest phrase first, so composed names work too:
// 'Satin Двоспальний 5x7' -> 'Satin Double 5x7', 'satЄ 5×7' -> 'satE 5×7'. A phrase matches only as a whole
// word (not inside a longer Cyrillic word); text with no known phrase (people, addresses, comments, names
// added in the ERP) is returned unchanged. Every English name is used once (the ERP maps names sent back in
// English to the stored Ukrainian ones – its src/mocks/localize.js).

export const CATALOG_EN = {
    // fabric types (warehouse) and product types (calculator)
    'Бязь': 'Calico',
    'Страйп-сатин': 'Stripe satin',
    'Сатин': 'Satin',
    'Поплін': 'Poplin',
    'Ранфорс': 'Ranforce',
    'Перкаль': 'Percale',
    'Муслін': 'Muslin',
    'бязь': 'calico',
    'сатин': 'satin',
    'полікотон': 'polycotton',
    'Полікотон': 'Polycotton',

    // fabric tags
    'дитяче': 'children\'s',
    'транспортна тематика': 'transport theme',
    'дитячий Тачка Маквін': 'kids, Lightning McQueen',
    'різнокольоровий': 'multicoloured',
    'з геометричним принтом': 'geometric print',
    'однотонний білий': 'plain white',
    'ліловий': 'lilac',
    'орнамент': 'ornament',
    'з котиками': 'with cats',
    'в ромби': 'diamond pattern',
    'гірчичний': 'mustard',
    'з мультиплікаційним принтом': 'cartoon print',
    'фіолетовий': 'purple',
    'бордовий': 'burgundy',
    'для дівчинки рожевий': 'pink, for girls',
    'з текстовим принтом': 'text print',
    'молочний': 'milky white',
    'сірий з помаранчевим': 'grey with orange',
    'з малюнком птахів': 'bird print',
    'космос': 'space',
    'червоний': 'red',
    'персиковий': 'peach',
    'темно-сірий': 'dark grey',
    'кремовий': 'cream',
    'шоколад': 'chocolate',
    'фіолетовий з квітами': 'purple with flowers',
    'коричневий': 'brown',
    'з геометричним малюнком': 'geometric pattern',
    'білий з колосками': 'white with wheat ears',
    'з динозаврами': 'with dinosaurs',
    'з урбаністичним принтом': 'urban print',
    'з квітами': 'with flowers',
    'дитячий з малюнком тварин': 'kids, animal print',
    'з рисунком тварин': 'animal pattern',
    'чорний': 'black',
    'білий': 'white',
    'помаранчевий': 'orange',
    'з квітковим принтом': 'floral print',
    'сірий': 'grey',
    'бежевий': 'beige',
    'однотонний сірий': 'plain grey',
    'зірки': 'stars',
    'дитячий': 'kids',
    'з малюнком тварин': 'animal print',
    'в смужку': 'striped',
    'рожевий': 'pink',
    'однотонний': 'plain',
    'зелений': 'green',
    'світло-сірий': 'light grey',
    'жовтий': 'yellow',
    'з рослинним принтом': 'botanical print',
    'з сердечками': 'with hearts',
    'в клітинку': 'checked',
    'блакитний': 'light blue',
    'абстракція': 'abstract',

    // product categories, colours, products
    'Ковдра': 'Blanket',
    'Подушка': 'Pillow',
    'Наматрацник': 'Mattress protector',
    'Білий': 'White',
    'Бежевий': 'Beige',
    'Сірий': 'Grey',
    'Блакитний': 'Light blue',
    'Рожевий': 'Pink',
    'Червоний': 'Red',
    'Салатовий': 'Light green',
    'Ковдра Холофайбер': 'Hollow-fibre blanket',
    'Ковдра ЕкоПух': 'Eco-down blanket',
    'Ковдра 4 сезони': '4-season blanket',
    'Подушка 4 сезони': '4-season pillow',
    'Подушка Еко Пух': 'Eco-down pillow',
    'Подушка Літня': 'Summer pillow',
    'Ковдра Літня': 'Summer blanket',
    'Ковдра Дитяча': 'Kids blanket',
    'Подушка Дитяча': 'Kids pillow',
    'Ковдра Бамбук': 'Bamboo blanket',
    'Подушка Бамбук': 'Bamboo pillow',
    'Ковдра Вовняна': 'Wool blanket',
    'Подушка Анатомічна': 'Orthopaedic pillow',
    'Наматрацник Моніка': 'Monika mattress protector',

    // calculator: component types, components (and their short names), option parts, options
    'Наволочка': 'Pillowcase',
    'Простирадло': 'Sheet',
    'Підковдра': 'Duvet cover',
    'Нав': 'PC',
    'Прос': 'SH',
    'Пст': 'SHT',
    'Прт': 'SHR',
    'Ков': 'DC',
    'Собачка': 'Zip puller',
    'Накладка': 'Topper',
    'Застібачка': 'Fastener',
    'Одношарове з текстурою': 'Single-layer, textured',
    'Одношарова накладка для простирадла': 'Single-layer topper for the sheet',
    'Протектор': 'Protector',
    'Додатковий Протектор для підковдри': 'Extra protector for the duvet cover',
    'Замок': 'Zip',
    'Замок для наволочки': 'Zip for the pillowcase',
    'Вушка': 'Flanges',
    'Вушка до наволочки': 'Flanges for the pillowcase',
    'Подарункове пакування': 'Gift packaging',
    'Комплект у подарунковій коробці зі стрічкою': 'Set in a gift box with a ribbon',
    'Сумка-чохол': 'Storage bag',
    'Тканинна сумка для зберігання комплекту': 'Fabric bag to store the set',
    'Прокладка': 'Interlining',
    'Чохол на матрац': 'Mattress cover',
    'Стьобаний чохол на матрац з тканини комплекту': 'Quilted mattress cover made of the set\'s fabric',
    'Комплект': 'Bedding set',

    // kit sizes (and their short names)
    'Полуторний': 'Single',
    'Двоспальний': 'Double',
    'Євро Макс': 'Euro Max',
    'Євро': 'Euro',
    'Сімейний': 'Family',
    'Є max': 'E max',
    'Є': 'E',
    '7,Я': 'Fam',

    // warehouses
    'Основний склад': 'Main warehouse',
    'Склад №2': 'Warehouse No. 2',

    // pricelists
    'Старий прайс 2024': 'Old price list 2024',
    'Ціни до подорожчання тканин у 2025 році': 'Prices before the 2025 fabric price rise',
    'Стандартний список': 'Standard list',
    'Список із стандартними цінами, з якого будуть братись ціни якщо немає іншого активного списку':
        'List of standard prices, used when there is no other active list',
    'Оптовий': 'Wholesale',
    'Ціни для оптових покупців від 10 комплектів': 'Prices for wholesale buyers, from 10 sets',
    'Маркетплейси': 'Marketplaces',
    'Ціни для Rozetka, Prom та Епіцентр з урахуванням комісії': 'Prices for Rozetka, Prom and Epicentr, commission included',
    'Соцмережі і месенджери': 'Social media and messengers',
    'Акційні ціни для замовлень із соцмереж і месенджерів': 'Promo prices for orders from social media and messengers',
    'Дропшипінг': 'Dropshipping',
    'Ціни для партнерів, які продають під своїм брендом': 'Prices for partners selling under their own brand',
    'Готелі': 'Hotels',
    'Ціни для готелів і хостелів': 'Prices for hotels and hostels',
    'Шоуруми': 'Showrooms',
    'Ціни для продажу в шоурумах': 'Prices for sales in showrooms',

    // order sources
    'Viber-розсилка': 'Viber mailing',
    'Сайт': 'Website',
    'Інстаграм': 'Instagram',
    'Оптовий відділ': 'Wholesale department',
    'Епіцентр': 'Epicentr',
    'Дропшипінг-партнери': 'Dropshipping partners',
    'Готельні замовлення': 'Hotel orders',
    'Шоурум (Київ)': 'Showroom (Kyiv)',
};

const CYRILLIC = 'А-Яа-яЁёІіЇїЄєҐґ\'’';
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PHRASES = Object.keys(CATALOG_EN).sort((a, b) => b.length - a.length);
const PATTERN = new RegExp(`(?<![${CYRILLIC}])(?:${PHRASES.map(escape).join('|')})(?![${CYRILLIC}])`, 'g');

/** The English version of a catalog name (or of a text made of catalog names); other text is returned as is. */
export const localizeCatalogText = (text) => (typeof text === 'string' && /[Ѐ-ӿ]/.test(text)
    ? text.replace(PATTERN, (phrase) => CATALOG_EN[phrase])
    : text);
