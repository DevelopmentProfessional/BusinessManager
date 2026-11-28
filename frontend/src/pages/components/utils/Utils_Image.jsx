import { useEffect, useState } from "react";
import api, { inventoryAPI } from "../../../services/api";

/**
 * Get the best display image URL for an inventory item.
 * Checks the new images[] array first (primary, then first),
 * then falls back to the legacy image_url field.
 */
export function getDisplayImageUrl(item) {
  if (item?.images?.length > 0) {
    const primary = item.images.find((img) => img.is_primary);
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
  return null;
}

export function useAuthenticatedImageSrc(image) {
  const [src, setSrc] = useState(() => getImageSrc(image));

  useEffect(() => {
    let active = true;
    let objectUrl = null;
    const directSrc = getImageSrc(image);
    if (directSrc || !(image?.has_file || image?.file_path)) {
      setSrc(directSrc);
      return () => {};
    }

    setSrc(null);
    api.get(inventoryAPI.getImageFileUrl(image.id), { responseType: "blob" })
      .then(({ data }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(data);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (active) setSrc(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image?.id, image?.image_url, image?.has_file, image?.file_path]);

  return src;
}
