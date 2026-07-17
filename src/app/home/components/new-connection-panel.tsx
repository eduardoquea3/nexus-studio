import { SVGProps, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  RiDatabase2Fill,
  RiDatabase2Line,
  RiEyeLine,
  RiEyeOffLine,
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
import { Input, type InputProps } from "@/shared/components/ui/input";
import { Field } from "@/shared/components/ui/field";
import { FileField } from "@/shared/components/ui/file-field";
import { Select } from "@/shared/components/ui/select";
import { Panel } from "@/shared/components/panel";
import { useModalStore } from "@/shared/store/modalStore";
import { useConnectionStore } from "@/shared/store/connectionStore";
import { useQueryClient } from "@tanstack/react-query";
import { connectionsQueryKey } from "@/app/home/hooks/use-connections";
import { getConnection } from "@/app/home/services/connection-service";
import { HomePanels } from "../lib/home-panels";
import {
  saveConnection,
  testConnectionFields,
  type ConnectionTestRequest,
} from "@/shared/lib/tauriApi";
import type { ConnectionProfile, DbType } from "@/shared/types/models";

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

type ConnectionFormValues = {
  dbType: "postgresql" | "mysql" | "sqlite";
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  sqlitePath: string;
};

const initialFormValues: ConnectionFormValues = {
  dbType: "postgresql",
  name: "",
  host: "localhost",
  port: "5432",
  database: "",
  username: "postgres",
  password: "",
  sqlitePath: "",
};

export function NewConnectionPanel() {
  const closeModal = useModalStore((state) => state.closeModal);
  const modalPayload = useModalStore(
    (state) => state.modalProps[HomePanels.NewConnection] as { connectionId?: string } | undefined,
  );
  const addProfile = useConnectionStore((state) => state.addProfile);
  const updateProfile = useConnectionStore((state) => state.updateProfile);
  const queryClient = useQueryClient();
  const editingId = modalPayload?.connectionId;
  const [form, setForm] = useState(initialFormValues);
  const [sshAuthType, setSshAuthType] = useState("key-file");
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!editingId) {
      setIsLoadingProfile(false);
      setForm(initialFormValues);
      return;
    }

    setIsLoadingProfile(true);
    void getConnection(editingId)
      .then((profile) => {
        if (!cancelled && profile) {
          setForm(profileToFormValues(profile));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editingId]);

  const updateField = <K extends keyof ConnectionFormValues>(
    field: K,
    value: ConnectionFormValues[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const getTestRequest = () =>
    ({
      dbType: form.dbType === "postgresql" ? "postgres" : form.dbType,
      host: form.host,
      port: Number(form.port),
      database: form.database,
      username: form.username,
      password: form.password,
      sqlitePath: form.sqlitePath,
    }) as const;

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const request = getTestRequest();
      console.info("[connection-test] target", formatConnectionTarget(request));
      const message = await testConnectionFields(request);
      toast.success("Connection successful", { description: message });
    } catch (error) {
      toast.error("Connection failed", { description: String(error) });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async () => {
    setIsTesting(true);
    try {
      await testConnectionFields(getTestRequest());
      const profile = createConnectionProfile(form, editingId);
      await saveConnection(profile);
      if (editingId) {
        updateProfile(profile);
      } else {
        addProfile(profile);
      }
      await queryClient.invalidateQueries({ queryKey: connectionsQueryKey });
      toast.success(editingId ? "Connection updated" : "Connection saved", {
        description: "The connection profile and its credentials were saved locally.",
      });
      closeModal(HomePanels.NewConnection);
    } catch (error) {
      toast.error("Could not save connection", { description: String(error) });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Panel
      panelId={HomePanels.NewConnection}
      title={editingId ? "Edit Connection" : "New Connection"}
      description={
        editingId
          ? "Update the saved connection profile."
          : "Create a reusable connection from the dashboard."
      }
      icon={<RiDatabase2Fill size={19} />}
      className="w-140"
    >
      <div className="flex flex-col gap-4 text-sm">
        <Field label="Connection Type">
          <Select
            options={connectionTypes}
            valueKey="value"
            value={connectionTypes.find((item) => item.value === form.dbType)}
            onValueChange={(value) =>
              value && updateField("dbType", value.value as ConnectionFormValues["dbType"])
            }
            render={(option) => <ConnectionTypeOption type={option} />}
            placeholder="Select type"
          />
        </Field>

        {form.dbType === "sqlite" ? (
          <FileField
            label="File path"
            placeholder="Select a SQLite database"
            onPathChange={(path) => updateField("sqlitePath", path)}
          />
        ) : (
          <DatabaseConnectionFields
            values={form}
            onChange={updateField}
            sshAuthType={sshAuthType}
            onSshAuthTypeChange={(value) => value && setSshAuthType(value)}
          />
        )}

        <Field label="Connection name">
          <Input
            iconLeft={RiDatabase2Line}
            placeholder="Production database"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border">
        <Button variant="outline" onClick={() => closeModal(HomePanels.NewConnection)}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void handleTest()}
            disabled={isTesting || isLoadingProfile}
          >
            Test
          </Button>
          <Button onClick={() => void handleConnect()} disabled={isTesting || isLoadingProfile}>
            {editingId ? "Save changes" : "Connect"}
          </Button>
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

function createConnectionProfile(values: ConnectionFormValues, id?: string): ConnectionProfile {
  const dbType: DbType = values.dbType === "postgresql" ? "postgres" : values.dbType;

  return {
    id: id ?? crypto.randomUUID(),
    name: values.name.trim() || `${dbType} connection`,
    db_type: dbType,
    password: values.password,
    connect_mode:
      dbType === "sqlite"
        ? { type: "connection_string", value: values.sqlitePath }
        : {
            type: "fields",
            host: values.host,
            port: Number(values.port),
            database: values.database,
            username: values.username,
            password_ref: null,
          },
    ssh_tunnel: null,
  };
}

function profileToFormValues(profile: ConnectionProfile): ConnectionFormValues {
  if (profile.connect_mode.type === "connection_string") {
    return {
      dbType: profile.db_type === "postgres" ? "postgresql" : profile.db_type,
      name: profile.name,
      host: "localhost",
      port: "5432",
      database: "",
      username: "",
      password: profile.password ?? "",
      sqlitePath: profile.connect_mode.value,
    };
  }

  return {
    dbType: profile.db_type === "postgres" ? "postgresql" : profile.db_type,
    name: profile.name,
    host: profile.connect_mode.host,
    port: String(profile.connect_mode.port),
    database: profile.connect_mode.database,
    username: profile.connect_mode.username,
    password: profile.password ?? "",
    sqlitePath: "",
  };
}

function DatabaseConnectionFields({
  values,
  onChange,
  sshAuthType,
  onSshAuthTypeChange,
}: {
  values: ConnectionFormValues;
  onChange: <K extends keyof ConnectionFormValues>(
    field: K,
    value: ConnectionFormValues[K],
  ) => void;
  sshAuthType: string;
  onSshAuthTypeChange: (value: string | null) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <Field label="Host">
          <Input
            iconLeft={RiServerLine}
            value={values.host}
            onChange={(event) => onChange("host", event.target.value)}
            placeholder="localhost"
          />
        </Field>
        <Field label="Port">
          <Input
            iconLeft={RiGlobalLine}
            value={values.port}
            onChange={(event) => onChange("port", event.target.value)}
            placeholder="5432"
            inputMode="numeric"
          />
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
          <Input
            iconLeft={RiUserLine}
            value={values.username}
            onChange={(event) => onChange("username", event.target.value)}
            placeholder="Username"
          />
        </Field>
        <Field label="Password">
          <PasswordInput
            iconLeft={RiLockPasswordLine}
            value={values.password}
            onChange={(event) => onChange("password", event.target.value)}
            placeholder="Password"
          />
        </Field>
      </div>

      <Field label="Database">
        <Input
          iconLeft={RiDatabase2Line}
          value={values.database}
          onChange={(event) => onChange("database", event.target.value)}
          placeholder="Database name"
        />
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
                    <PasswordInput
                      iconLeft={RiLockPasswordLine}
                      placeholder="SSH password"
                    />
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

function formatConnectionTarget(request: ConnectionTestRequest) {
  if (request.dbType === "sqlite") {
    return `sqlite://${request.sqlitePath ?? ""}`;
  }

  const username = request.username ?? "";
  const host = request.host ?? "";
  const port = request.port ?? "";
  const database = request.database ?? "";

  return `${request.dbType}://${username}:***@${host}:${port}/${database}`;
}

type PasswordInputProps = Omit<InputProps, "type" | "iconRight" | "iconRightClick">;

function PasswordInput(props: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Input
      {...props}
      type={isVisible ? "text" : "password"}
      iconRight={isVisible ? RiEyeOffLine : RiEyeLine}
      iconRightClick={() => setIsVisible((visible) => !visible)}
      aria-label={isVisible ? "Hide password" : "Show password"}
    />
  );
}
