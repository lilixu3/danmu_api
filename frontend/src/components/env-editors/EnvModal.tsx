import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TextEditor } from "@/components/env-editors/TextEditor";
import { BooleanEditor } from "@/components/env-editors/BooleanEditor";
import { NumberEditor } from "@/components/env-editors/NumberEditor";
import { SelectEditor } from "@/components/env-editors/SelectEditor";
import { MultiSelectEditor } from "@/components/env-editors/MultiSelectEditor";
import { MapEditor } from "@/components/env-editors/MapEditor";
import { ColorPoolEditor } from "@/components/env-editors/ColorPoolEditor";
import { DanmuOffsetEditor } from "@/components/env-editors/DanmuOffsetEditor";
import { CustomMergeRulesEditor } from "@/components/env-editors/CustomMergeRulesEditor";
import { AiApiKeyEditor } from "@/components/env-editors/AiApiKeyEditor";
import { BilibiliCookieEditor } from "@/components/env-editors/BilibiliCookieEditor";
import { CATEGORY_LABELS, SPECIAL_ENV_KEYS } from "@/lib/constants";
import { useState, useEffect } from "react";
import type { EnvVarItem } from "@/lib/api";

export interface EnvEditorProps {
  item: EnvVarItem;
  value: string;
  onChange: (value: string) => void;
}

export interface EnvModalProps {
  open: boolean;
  onClose: () => void;
  item?: EnvVarItem | null;
  category: string;
  onSave: (key: string, value: string) => void;
}

export function EnvModal({ open, onClose, item, category, onSave }: EnvModalProps) {
  const [value, setValue] = useState(item?.value || "");

  useEffect(() => {
    setValue(item?.value || "");
  }, [item]);

  if (!item) return null;

  const renderEditor = () => {
    const props = { item, value, onChange: setValue };
    switch (item.key) {
      case SPECIAL_ENV_KEYS.COLOR_POOL:
        return <ColorPoolEditor {...props} />;
      case SPECIAL_ENV_KEYS.DANMU_OFFSET:
        return <DanmuOffsetEditor {...props} />;
      case SPECIAL_ENV_KEYS.CUSTOM_MERGE_RULES:
        return <CustomMergeRulesEditor {...props} />;
      case SPECIAL_ENV_KEYS.AI_API_KEY:
        return <AiApiKeyEditor {...props} />;
      case SPECIAL_ENV_KEYS.BILIBILI_COOKIE:
        return <BilibiliCookieEditor {...props} />;
    }
    switch (item.type) {
      case "boolean":
        return <BooleanEditor {...props} />;
      case "number":
        return <NumberEditor {...props} />;
      case "select":
        return <SelectEditor {...props} />;
      case "multi-select":
        return <MultiSelectEditor {...props} />;
      case "map":
        return <MapEditor {...props} />;
      default:
        return <TextEditor {...props} />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>编辑配置项</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>变量名</Label>
            <div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm">
              {item.key}
            </div>
          </div>
          <div>
            <Label>类别</Label>
            <div className="text-sm">
              {CATEGORY_LABELS[category] || category} / {item.type}
            </div>
          </div>
          <div>
            <Label>值</Label>
            {renderEditor()}
          </div>
          {item.description && (
            <div>
              <Label>描述</Label>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => onSave(item.key, value)}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
