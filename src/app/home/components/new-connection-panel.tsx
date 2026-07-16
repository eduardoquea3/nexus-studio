import { SVGProps, useRef, useState, type ReactNode } from "react";
import { RiDatabase2Fill, RiFolderOpenLine } from "@remixicon/react";
import { MySQLDark, PostgreSQL, SQLite } from "@ridemountainpig/svgl-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/animate-ui/components/radix/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel } from "@/shared/components/panel";
import { useModalStore } from "@/shared/store/modalStore";
import { HomePanels } from "../lib/home-panels";
import { newConnectionSchema } from "../schemas/connectionSchema";

type ConnectionType = {
  value: string;
  label: string;
  icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
};

const connectionTypes = [
  { value: "mysql", label: "MySQL", icon: MySQLDark },
  { value: "postgresql", label: "PostgreSQL", icon: PostgreSQL },
  { value: "sqlite", label: "SQLite", icon: SQLite },
] satisfies readonly ConnectionType[];

export function NewConnectionPanel() {
  const closeModal = useModalStore((state) => state.closeModal);
  const [connectionType, setConnectionType] = useState("postgresql");
  const [sshAuthType, setSshAuthType] = useState("key-file");

  void newConnectionSchema;

  return (
    <Panel
      panelId={HomePanels.NewConnection}
      title="New Connection"
      description="Create a reusable connection from the dashboard."
      icon={<RiDatabase2Fill size={19} />}
      className="w-140"
    >
      <div className="flex flex-col gap-4 text-sm">
        <Field label="Connection Type">
          <Select
            value={connectionType}
            onValueChange={(value) => value && setConnectionType(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type">
                {(value) =>
                  value ? (
                    <ConnectionTypeOption
                      type={connectionTypes.find((item) => item.value === value)}
                    />
                  ) : (
                    <span className="text-muted-foreground">Select type</span>
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {connectionTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <ConnectionTypeOption type={type} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {connectionType === "sqlite" ? (
          <FileField label="File path" placeholder="Select a SQLite database" />
        ) : (
          <DatabaseConnectionFields
            sshAuthType={sshAuthType}
            onSshAuthTypeChange={(value) => value && setSshAuthType(value)}
          />
        )}

        <Field label="Connection name">
          <Input placeholder="Production database" />
        </Field>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <Button variant="outline" onClick={() => closeModal(HomePanels.NewConnection)}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline">Test</Button>
          <Button>Connect</Button>
        </div>
      </div>
    </Panel>
  );
}

function ConnectionTypeOption({ type }: { type?: ConnectionType }) {
  if (!type) {
    return null;
  }

  const { icon: Icon, label } = type;
  return (
    <span className="flex items-center gap-2">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function DatabaseConnectionFields({
  sshAuthType,
  onSshAuthTypeChange,
}: {
  sshAuthType: string;
  onSshAuthTypeChange: (value: string | null) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <Field label="Host">
          <Input placeholder="localhost" />
        </Field>
        <Field label="Port">
          <Input placeholder="5432" inputMode="numeric" />
        </Field>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="ssl" className="border-0">
          <AccordionTrigger className="h-10 rounded-md border border-input bg-muted/30 px-3 py-0 hover:no-underline flex items-center">
            SSL
          </AccordionTrigger>
          <AccordionContent className="pt-3">
            <div className="grid gap-3">
              <FileField label="CA certificate" placeholder="Select CA certificate" />
              <FileField label="Certificate" placeholder="Select certificate" />
              <FileField label="Key file" placeholder="Select private key" />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="grid grid-cols-2 gap-3">
        <Field label="User">
          <Input placeholder="Username" />
        </Field>
        <Field label="Password">
          <Input type="password" placeholder="Password" />
        </Field>
      </div>

      <Field label="Database">
        <Input placeholder="Database name" />
      </Field>

      <Accordion type="single" collapsible>
        <AccordionItem value="ssh" className="border-0">
          <AccordionTrigger className="h-10 rounded-md border border-input bg-muted/30 px-3 py-0 hover:no-underline flex items-center">
            SSH tunnel
          </AccordionTrigger>
          <AccordionContent className="pt-3">
            <div className="grid gap-3">
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                <Field label="Host">
                  <Input placeholder="ssh.example.com" />
                </Field>
                <Field label="Port">
                  <Input placeholder="22" inputMode="numeric" />
                </Field>
              </div>

              <Field label="Authentication">
                <Select value={sshAuthType} onValueChange={onSshAuthTypeChange}>
                  <SelectTrigger className="h-10">
                    <SelectValue className="h-10" placeholder="Select authentication" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="key-file">Key file</SelectItem>
                    <SelectItem value="password">User and password</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {sshAuthType === "key-file" ? (
                <FileField label="SSH key file" placeholder="Select SSH key" />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SSH user">
                    <Input placeholder="SSH username" />
                  </Field>
                  <Field label="SSH password">
                    <Input type="password" placeholder="SSH password" />
                  </Field>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function FileField({ label, placeholder }: { label: string; placeholder: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input value={fileName} placeholder={placeholder} readOnly aria-label={`${label} path`} />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 size-10"
          onClick={() => inputRef.current?.click()}
          aria-label={`Browse for ${label}`}
        >
          <RiFolderOpenLine size={20} />
          <span className="sr-only">Browse</span>
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
        />
      </div>
    </Field>
  );
}
