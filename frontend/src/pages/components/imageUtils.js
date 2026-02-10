import { inventoryAPI } from '../../services/api';

/**
 * Get the best display image URL for an inventory item.
 * Checks the new images[] array first (primary, then first),
 * then falls back to the legacy image_url field.
 */
export function getDisplayImageUrl(item) {
  if (item?.images?.length > 0) {
    const primary = item.images.find(img => img.is_primary);
    const img = primary || item.images[0];
    return getImageSrc(img);
  }
  return item?.image_url || null;
}

/**
 * Get a browser-usable src URL for a single InventoryImage record.
 * URL-type images use image_url directly; file-type images use the serving endpoint.
 */
export function getImageSrc(image) {
  if (!image) return null;
  if (image.image_url) return image.image_url;
  if (image.file_path) return inventoryAPI.getImageFileUrl(image.id);
  return null;
}
