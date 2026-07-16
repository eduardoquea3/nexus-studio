import { useRef, useState } from "react";
import { RiFolderOpenLine } from "@remixicon/react";

import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface FileFieldProps {
  label: string;
  placeholder: string;
}

function FileField({ label, placeholder }: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  return (
    <Field label={label}>
      <Input
        value={fileName}
        placeholder={placeholder}
        readOnly
        aria-label={`${label} path`}
        iconRight={RiFolderOpenLine}
        iconRightClick={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
      />
    </Field>
  );
}

export { FileField, type FileFieldProps };
