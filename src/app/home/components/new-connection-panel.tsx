import { SVGProps, useState } from "react";
import {
  RiDatabase2Fill,
  RiDatabase2Line,
  RiGlobalLine,
  RiLockPasswordLine,
  RiServerLine,
  RiShieldKeyholeLine,
  RiTerminalBoxLine,
  RiUserLine,
} from "@remixicon/react";
import { MySQLDark, PostgreSQL, SQLite } from "@ridemountainpig/svgl-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/animate-ui/components/radix/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Field } from "@/shared/components/ui/field";
import { FileField } from "@/shared/components/ui/file-field";
import { Select } from "@/shared/components/ui/select";
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

const sshAuthTypes = [
  { value: "key-file", label: "Key file" },
  { value: "password", label: "User and password" },
] as const;

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
            options={connectionTypes}
            valueKey="value"
            value={connectionTypes.find((item) => item.value === connectionType)}
            onValueChange={(value) => value && setConnectionType(value.value)}
            render={(option) => <ConnectionTypeOption type={option} />}
            placeholder="Select type"
          />
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
          <Input iconLeft={RiDatabase2Line} placeholder="Production database" />
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
          <Input iconLeft={RiServerLine} placeholder="localhost" />
        </Field>
        <Field label="Port">
          <Input iconLeft={RiGlobalLine} placeholder="5432" inputMode="numeric" />
        </Field>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="ssl" className="border-0">
          <AccordionTrigger className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-0 hover:no-underline">
            <RiShieldKeyholeLine className="size-4 text-muted-foreground" aria-hidden="true" />
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
          <Input iconLeft={RiUserLine} placeholder="Username" />
        </Field>
        <Field label="Password">
          <Input iconLeft={RiLockPasswordLine} type="password" placeholder="Password" />
        </Field>
      </div>

      <Field label="Database">
        <Input iconLeft={RiDatabase2Line} placeholder="Database name" />
      </Field>

      <Accordion type="single" collapsible>
        <AccordionItem value="ssh" className="border-0">
          <AccordionTrigger className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-0 hover:no-underline">
            <RiTerminalBoxLine className="size-4 text-muted-foreground" aria-hidden="true" />
            SSH tunnel
          </AccordionTrigger>
          <AccordionContent className="pt-3">
            <div className="grid gap-3">
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                <Field label="Host">
                  <Input iconLeft={RiServerLine} placeholder="ssh.example.com" />
                </Field>
                <Field label="Port">
                  <Input iconLeft={RiGlobalLine} placeholder="22" inputMode="numeric" />
                </Field>
              </div>

              <Field label="Authentication">
                <Select
                  options={sshAuthTypes}
                  valueKey="value"
                  value={sshAuthTypes.find((option) => option.value === sshAuthType)}
                  onValueChange={(option) => onSshAuthTypeChange(option?.value ?? null)}
                  placeholder="Select authentication"
                  className="h-10"
                />
              </Field>

              {sshAuthType === "key-file" ? (
                <FileField label="SSH key file" placeholder="Select SSH key" />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SSH user">
                    <Input iconLeft={RiUserLine} placeholder="SSH username" />
                  </Field>
                  <Field label="SSH password">
                    <Input iconLeft={RiLockPasswordLine} type="password" placeholder="SSH password" />
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

