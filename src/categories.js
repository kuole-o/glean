const DEFAULT_CATEGORIES = '原创,动画,歌词,游戏,文学,网络,影视,诗词,哲学,抖机灵,其他';

export function getCategories() {
  const raw = process.env.CATEGORIES || DEFAULT_CATEGORIES;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}
