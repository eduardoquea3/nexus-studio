import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { RiFolderOpenLine } from "@remixicon/react";

import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface FileFieldProps {
  label: string;
  placeholder: string;
  onPathChange?: (path: string) => void;
}

function FileField({ label, placeholder, onPathChange }: FileFieldProps) {
  const [fileName, setFileName] = useState("");

  const handlePickFile = async () => {
    const path = await open({ multiple: false, directory: false });
    if (typeof path !== "string") {
      return;
    }

    setFileName(path.split(/[\\/]/).pop() ?? path);
    onPathChange?.(path);
  };

  return (
    <Field label={label}>
      <Input
        value={fileName}
        placeholder={placeholder}
        readOnly
        aria-label={`${label} path`}
        iconRight={RiFolderOpenLine}
        iconRightClick={() => void handlePickFile()}
      />
    </Field>
  );
}

export { FileField, type FileFieldProps };
