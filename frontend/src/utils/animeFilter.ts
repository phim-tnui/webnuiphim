/**
 * 🎌 ANIME & DONGHUA STRICT FILTER UTILITY
 * Đảm bảo các chủ đề con người (người đóng / live-action) KHÔNG bao giờ chứa Anime hoặc Donghua.
 * Anime & Donghua chỉ xuất hiện duy nhất ở chuyên mục "Hoạt Hình".
 */

export interface MinimalMetaItem {
  id?: string;
  name?: string;
  originName?: string;
  original_name?: string;
  type?: string;
  description?: string;
  content?: string;
  genre?: string | string[];
  genres?: string | string[];
  category?: Array<{ name?: string; slug?: string }>;
  poster?: string;
  background?: string;
  year?: string | number;
}

// 1. Danh sách từ khóa Donghua (Hoạt hình 3D / Tu tiên Trung Quốc)
const DONGHUA_KEYWORDS = [
  'mục thần ký', 'muc than ky', 'herding gods', 'tales of herding gods',
  'vạn giới', 'phàm nhân', 'đấu la', 'đấu phá', 'thôn phệ', 'hoàn mỹ thế giới',
  'già thiên', 'nghịch thiên', 'tiên nghịch', 'linh kiếm tôn', 'vũ canh kỷ',
  'tây hành kỷ', 'tu tiên', 'đại lục linh', 'linh võ', 'yêu thần ký',
  'trùng sinh', 'tuyết ưng', 'bách luyện', 'thương nguyên', 'sư huynh',
  'võ thần', 'linh vũ', 'võ luyện', 'tinh thần biến', 'nguyên tôn',
  'thần ấn vương tọa', 'nhất niệm vĩnh hằng', 'luyện khí mười vạn năm',
  'luyện khí 10 vạn năm', 'tuyệt thế đường môn', 'toàn chức pháp sư',
  'toàn chức cao thủ', 'ma đạo tổ sư', 'thiên quan tứ phúc', 'trấn hồn nhai',
  'thần mộ', 'trường an tam vạn dặm', 'họa giang hồ', 'bạch xà',
  'tân phong thần', 'na tra', 'tây du ký tái thế', 'khương tử nha',
  'thôn phệ tinh không', 'đại chúa tể', 'dai chua te', 'kiếm lai', 'jian lai',
  'vô thượng thần đế', 'vạn cổ thần thoại', 'vạn giới độc tôn', 'độc bộ tiêu dao',
  'nghịch thiên chí tôn', 'nghịch thiên tà thần', 'đan đạo chí tôn', 'thần đạo đế tôn',
  'thần lan kỳ vực', 'wan jie', 'fan ren', 'dou luo', 'dou po', 'swallowed star',
  'perfect world', 'renegade immortal', 'soul land', 'battle through the heavens',
  'shrouding the heavens', 'a will eternal', 'martial universe', 'phim 3d trung quốc'
];

// 2. Danh sách từ khóa Anime Nhật Bản (Tên tiếng Việt, tiếng Anh và Romaji)
const ANIME_KEYWORDS = [
  'anime', 'donghua', 'animation', 'animated', 'cartoon', 'hoạt hình', 'hoathinh',
  'one piece', 'naruto', 'boruto', 'conan', 'dragon ball', 'jujutsu kaisen',
  'kimetsu', 'demon slayer', 'bleach', 'attack on titan', 'hunter x hunter',
  'solo leveling', 'mushoku tensei', 're:zero', 'slime', 'sword art online',
  'haikyu', 'chainsaw man', 'spy x family', 'tokyo ghoul', 'doraemon', 'pokemon',
  'digimon', 'gundam', 'beyblade', 'thanh gươm diệt quỷ', 'chú thuật hồi chiến',
  'đại chiến titan', 'thám tử lừng danh', 'thất hình đại tội', 'học viện siêu anh hùng',
  'thợ săn tiền thưởng', 'vua hải tặc', 'bảy viên ngọc rồng', 'đao kiếm thần vực',
  'vô thức tái sinh', 'chuyển sinh thành slime', 'vua trò chơi', 'thủ lĩnh thẻ bài',
  'shin cậu bé bút chì', 'áo giáp vàng', 'vùng đất linh hồn', 'lâu đài bay của howl',
  'hàng xóm của tôi là totoro', 'mộ đom đóm', 'inuyasha', 'ranma', 'sailor moon',
  'ghibli', 'danmachi', 'frieren', 'kaiju no. 8', 'wind breaker', 'oshi no ko',
  'blue lock', 'hell\'s paradise', 'vinland saga', 'jojo', 'dr. stone',
  'shangri-la frontier', 'mashle', 'bocchi', 'delicious in dungeon', 'evangelion',
  'black clover', 'tokyo revengers', 'gintama', 'overlord', 'fate/stay', 'fate/zero',
  'monogatari', 'death note', 'fullmetal alchemist', 'one punch man', 'mob psycho',
  'steins;gate', 'code geass', 'tate no yuusha', 'isekai', 'bungo stray dogs',
  'classroom of the elite', 'kaguya-sama', 'chihiro'
];

/**
 * Kiểm tra xem một item có phải là Anime hoặc Donghua (phim hoạt hình) hay không
 */
export function isAnimeMetaItem(item: MinimalMetaItem | null | undefined): boolean {
  if (!item) return false;

  const rawType = (item.type || '').toLowerCase();
  if (rawType === 'hoathinh' || rawType === 'anime' || rawType === 'animation') {
    return true;
  }

  // Check genres
  const genreArr = Array.isArray(item.genres)
    ? item.genres
    : Array.isArray(item.genre)
    ? item.genre
    : [typeof item.genre === 'string' ? item.genre : ''];

  for (const g of genreArr) {
    if (!g) continue;
    const gLower = g.toLowerCase();
    if (
      gLower.includes('hoạt hình') ||
      gLower.includes('anime') ||
      gLower.includes('animation') ||
      gLower.includes('cartoon') ||
      gLower.includes('donghua')
    ) {
      return true;
    }
  }

  // Check category slugs/names
  if (Array.isArray(item.category)) {
    for (const c of item.category) {
      const s = (c.slug || '').toLowerCase();
      const n = (c.name || '').toLowerCase();
      if (
        s.includes('hoat-hinh') ||
        s.includes('anime') ||
        s.includes('donghua') ||
        s.includes('animation') ||
        n.includes('hoạt hình') ||
        n.includes('anime') ||
        n.includes('hoathinh')
      ) {
        return true;
      }
    }
  }

  const nameText = `${item.name || ''} ${item.originName || item.original_name || ''} ${item.id || ''}`.toLowerCase();
  const descText = `${item.description || ''} ${item.content || ''}`.toLowerCase();
  const fullText = `${nameText} ${descText}`;

  // Kiểm tra từ khóa hoạt hình chung
  if (
    fullText.includes('hoạt hình') ||
    fullText.includes('anime') ||
    fullText.includes('donghua') ||
    fullText.includes('animation') ||
    fullText.includes('cartoon') ||
    fullText.includes('hoạt họa') ||
    fullText.includes('phim 3d trung quốc')
  ) {
    return true;
  }

  // Kiểm tra Donghua keywords
  if (DONGHUA_KEYWORDS.some((kw) => nameText.includes(kw))) {
    return true;
  }

  // Kiểm tra Anime keywords
  if (ANIME_KEYWORDS.some((kw) => nameText.includes(kw))) {
    return true;
  }

  return false;
}

/**
 * Lọc bỏ 100% phim Anime/Donghua khỏi danh sách phim người đóng
 */
export function filterNonAnime<T extends MinimalMetaItem>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => !isAnimeMetaItem(item));
}

/**
 * 🌟 TUYỂN CHỌN BANNER "🔥 PHIM ĐỀ CỬ HÔM NAY" (SPOTLIGHT HERO)
 * Bộ mặt của web:
 * - Ưu tiên các phim bom tấn điện ảnh chiếu rạp mới nhất
 * - Hình ảnh catalog đẹp, rõ ràng, không vỡ
 * - Loại trừ 100% Anime / Donghua
 * - Không bao giờ trùng lặp phim
 */
export function curateSpotlightBlockbusters<T extends MinimalMetaItem>(
  theatricalItems: T[] = [],
  movieItems: T[] = [],
  fallbackItems: T[] = [],
  limit = 7
): T[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const curated: T[] = [];

  const candidates = [...theatricalItems, ...movieItems, ...fallbackItems];

  for (const item of candidates) {
    if (!item || !item.id || !item.name) continue;
    if (isAnimeMetaItem(item)) continue;

    // Phải có poster hoặc background hợp lệ
    const poster = item.poster || item.background || '';
    if (!poster || poster.includes('placeholder')) continue;

    const normId = item.id.toLowerCase();
    const normName = item.name.toLowerCase().trim();

    if (seenIds.has(normId) || seenNames.has(normName)) continue;

    seenIds.add(normId);
    seenNames.add(normName);
    curated.push(item);

    if (curated.length >= limit) break;
  }

  return curated;
}
