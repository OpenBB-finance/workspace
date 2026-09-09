import capitalize from "lodash/capitalize";
import type React from "react";
import { formatDate } from "~/lib/utils/utils";
import { SourceMeta } from "../DataConnectors/NewComponents/types";
import Icon from "../Icon";

interface WidgetItemProps {
  name: string;
  connectionType: string;
  category?: string;
  subCategory?: string;
  description?: string;
  imgUrl?: string;
  source?: string | string[];
  customIcon?: React.ReactNode;
  uploadedAt?: string | number;
}

const WidgetInfoTooltip: React.FC<WidgetItemProps> = ({
  name,
  connectionType,
  category,
  subCategory,
  description,
  imgUrl,
  source,
  customIcon,
  uploadedAt,
}) => {
  source = Array.isArray(source) ? source.join(", ") : source;

  const formattedDate = uploadedAt ? formatDate(new Date(uploadedAt)) : null;

  return (
    <div className="w-[332px]">
      <div className="flex items-center gap-2">
        <div>
          {customIcon || (
            <Icon
              id={SourceMeta[connectionType]?.icon ?? "widget"}
              className="size-4 min-w-4 text-brand-lighter dark:text-brand-main stroke-1.5"
            />
          )}
        </div>
        <span className="body-xs-medium line-clamp-2">{name}</span>
      </div>
      {(category || description || uploadedAt) && <hr className="obb-divider my-1.5" />}
      {category && (
        <p className="body-xs-medium mb-1.5 text-light-600 dark:text-dark-50">
          {[category && capitalize(category), subCategory && capitalize(subCategory)]
            .filter(Boolean)
            .join(" — ") || ""}
        </p>
      )}

      {description && (
        <div className="body-xs-regular dark:text-light-300 text-light-800 max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-light-400 dark:scrollbar-thumb-dark-300 scrollbar-track-transparent mb-1">
          {description}
          {description.length > 400 && (
            <div className="text-xs text-light-500 dark:text-dark-100 mt-1 italic">
              (scroll to read more)
            </div>
          )}
        </div>
      )}
      {imgUrl && <img src={imgUrl} alt={name} className="pt-2 w-full object-cover" />}
      {uploadedAt && (
        <p className="body-xs-regular mb-1.5 text-light-600 dark:text-dark-50">
          Uploaded: {formattedDate}
        </p>
      )}
      {source && (
        <div className="obb-uppercase-small-title pt-2 text-light-600 dark:text-dark-50">
          {source}
        </div>
      )}
    </div>
  );
};

export default WidgetInfoTooltip;
