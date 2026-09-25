import {
  RiArrowLeftLine,
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
import { useQueryClient } from "@tanstack/react-query";
import { save } from "@tauri-apps/plugin-dialog";
import { SVGProps, useEffect, useRef, useState } from "react";

import type { ConnectionProfile, DbType } from "@/shared/types/models";

import { connectionsQueryKey } from "@/app/home/hooks/use-connections";
import {
  getConnectionSessionKey,
  isUnsupportedLegacyConnection,
  shouldLoadConnectionProfile,
  shouldResetConnectionSession,
} from "@/app/home/lib/connection-panel-state";
import { parseConnectionString } from "@/app/home/lib/connection-string-parser";
import { getConnection } from "@/app/home/services/connection-service";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/animate-ui/components/radix/accordion";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Panel } from "@/shared/components/panel";
import { Field } from "@/shared/components/ui/field";
import { FileField } from "@/shared/components/ui/file-field";
import { Input, type InputProps } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import {
  saveConnection,
  createSqliteDatabase,
  testConnectionFields,
  listSshConfigAliases,
  type ConnectionTestRequest,
} from "@/shared/lib/tauriApi";
import { useConnectionStore } from "@/shared/store/connectionStore";
import { useModalStore } from "@/shared/store/modalStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { HomePanels } from "../lib/home-panels";

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

type ConnectionTab = "normal" | "ssh";
type SshSource = "manual" | { type: "config"; alias: string };

type ManualSshValues = {
  host: string;
  port: string;
  user: string;
  keyFile: string;
  password: string;
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

const initialManualSshValues: ManualSshValues = {
  host: "",
  port: "22",
  user: "",
  keyFile: "",
  password: "",
};

export function NewConnectionPanel() {
  const isOpen = useModalStore((state) => state.modals.includes(HomePanels.NewConnection));
  const closeModal = useModalStore((state) => state.closeModal);
  const modalPayload = useModalStore(
    (state) => state.modalProps[HomePanels.NewConnection] as { connectionId?: string } | undefined,
  );
  const addProfile = useConnectionStore((state) => state.addProfile);
  const updateProfile = useConnectionStore((state) => state.updateProfile);
  const queryClient = useQueryClient();
  const editingId = modalPayload?.connectionId;
  const [form, setForm] = useState(initialFormValues);
  const [connectionString, setConnectionString] = useState("");
  const [sshAuthType, setSshAuthType] = useState("key-file");
  const [connectionTab, setConnectionTab] = useState<ConnectionTab>("normal");
  const [sshAliases, setSshAliases] = useState<string[]>([]);
  const [sshSource, setSshSource] = useState<SshSource | null>(null);
  const [manualSshValues, setManualSshValues] = useState(initialManualSshValues);
  const [isTesting, setIsTesting] = useState(false);
  const [isCreatingSqlite, setIsCreatingSqlite] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [unsupportedLegacyProfileId, setUnsupportedLegacyProfileId] = useState<string>();
  const sessionKey = getConnectionSessionKey(isOpen, editingId);
  const sessionKeyRef = useRef<string | null>(null);
  const loadedProfileSessionKeyRef = useRef<string | null>(null);
  const importedFieldsRef = useRef<(keyof ConnectionFormValues)[]>([]);
  const isCurrentSession = sessionKeyRef.current === sessionKey;
  const isUnsupportedLegacyProfile =
    isCurrentSession &&
    editingId !== undefined &&
    unsupportedLegacyProfileId === editingId;
  const displayedForm = isCurrentSession ? form : initialFormValues;

  const clearImportedFormValues = () => {
    if (importedFieldsRef.current.length === 0) return;
    setForm(
      (current) =>
        ({
          ...current,
          ...Object.fromEntries(
            importedFieldsRef.current.map((field) => [field, initialFormValues[field]]),
          ),
        }) as ConnectionFormValues,
    );
    importedFieldsRef.current = [];
  };

  useEffect(() => {
    if (!isOpen) {
      setConnectionString("");
      clearImportedFormValues();
      sessionKeyRef.current = null;
      loadedProfileSessionKeyRef.current = null;
      setUnsupportedLegacyProfileId(undefined);
      return;
    }

    if (shouldResetConnectionSession(sessionKeyRef.current, sessionKey)) {
      sessionKeyRef.current = sessionKey;
      setForm(initialFormValues);
      setConnectionString("");
      setSshAuthType("key-file");
      setConnectionTab("normal");
      setSshSource(null);
      setManualSshValues(initialManualSshValues);
      setUnsupportedLegacyProfileId(undefined);
      loadedProfileSessionKeyRef.current = null;
      importedFieldsRef.current = [];
    }
  }, [isOpen, sessionKey]);

  useEffect(() => {
    let cancelled = false;

    if (
      !isOpen ||
      !editingId ||
      !shouldLoadConnectionProfile(loadedProfileSessionKeyRef.current, sessionKey, editingId)
    ) {
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);
    void getConnection(editingId)
      .then((profile) => {
        if (!cancelled && profile) {
          loadedProfileSessionKeyRef.current = sessionKey;
          setUnsupportedLegacyProfileId(
            isUnsupportedLegacyConnection(profile) ? profile.id : undefined,
          );
          setForm(profileToFormValues(profile));
          const tunnel = profile.ssh_tunnel;
          if (tunnel) {
            setConnectionTab("ssh");
            const source = tunnel.source;
            const auth = tunnel.auth;
            if (source.type === "from_ssh_config") {
              setSshSource({ type: "config", alias: source.alias });
            } else {
              setSshSource("manual");
              setManualSshValues((current) => ({
                ...current,
                host: source.host,
                port: String(source.port),
                user: source.user,
              }));
            }
            setSshAuthType(auth.type === "password" ? "password" : "key-file");
            if (auth.type === "key_file") {
              setManualSshValues((current) => ({
                ...current,
                keyFile: auth.path,
              }));
            }
          }
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
  }, [editingId, isOpen, sessionKey]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void listSshConfigAliases()
      .then((aliases) => {
        if (!cancelled) setSshAliases(aliases);
      })
      .catch(() => {
        if (!cancelled) setSshAliases([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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
      toast.add({ title: "Connection successful", type: "success", description: message });
    } catch (error) {
      toast.add({ title: "Connection failed", type: "error", description: String(error) });
    } finally {
      setIsTesting(false);
    }
  };

  const handleImportConnectionString = () => {
    const result = parseConnectionString(connectionString);
    if (!result.ok) {
      setConnectionString("");
      clearImportedFormValues();
      toast.add({
        title: "Could not import connection string",
        type: "error",
        description: result.error,
      });
      return;
    }

    const importedFields: (keyof ConnectionFormValues)[] =
      result.value.dbType === "sqlite"
        ? ["dbType", "sqlitePath"]
        : ["dbType", "host", "port", "database", "username", "password"];
    importedFieldsRef.current = [...new Set([...importedFieldsRef.current, ...importedFields])];
    setForm((current) =>
      result.value.dbType === "sqlite"
        ? { ...current, dbType: "sqlite", sqlitePath: result.value.sqlitePath }
        : {
            ...current,
            dbType: result.value.dbType,
            host: result.value.host,
            port: result.value.port,
            database: result.value.database,
            username: result.value.username,
            password: result.value.password,
          },
    );
    setConnectionString("");
  };

  const handleCreateSqliteDatabase = async () => {
    setIsCreatingSqlite(true);
    try {
      const path = await save({
        defaultPath: "database.sqlite",
        filters: [{ name: "SQLite database", extensions: ["sqlite", "db"] }],
      });
      if (!path) {
        return;
      }

      await createSqliteDatabase(path);
      updateField("sqlitePath", path);
      toast.add({
        title: "SQLite database created",
        type: "success",
        description: path,
      });
    } catch (error) {
      toast.add({
        title: "Could not create SQLite database",
        type: "error",
        description: String(error),
      });
    } finally {
      setIsCreatingSqlite(false);
    }
  };

  const handleConnect = async () => {
    if (connectionTab === "ssh" && sshSource === null) {
      toast.add({
        title: "Choose an SSH destination",
        type: "error",
        description: "Select an SSH config host or choose Manual before connecting.",
      });
      return;
    }
    if (isUnsupportedLegacyProfile) {
      toast.add({
        title: "Connection cannot be edited",
        type: "error",
        description: "This legacy connection format is preserved and cannot be safely edited here.",
      });
      return;
    }

    setIsTesting(true);
    try {
      await testConnectionFields(getTestRequest());
      const profile = createConnectionProfile(form, editingId, {
        enabled: connectionTab === "ssh",
        source: sshSource ?? "manual",
        authType: sshAuthType,
        manual: manualSshValues,
      });
      await saveConnection(profile);
      if (editingId) {
        updateProfile(profile);
      } else {
        addProfile(profile);
      }
      await queryClient.invalidateQueries({ queryKey: connectionsQueryKey });
      toast.add({
        title: editingId ? "Connection updated" : "Connection saved",
        type: "success",
        description: "The connection profile and its credentials were saved locally.",
      });
      closeModal(HomePanels.NewConnection);
    } catch (error) {
      toast.add({ title: "Could not save connection", type: "error", description: String(error) });
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
      footer={
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-popover px-6 py-4">
          <Button
            variant="outline"
            onClick={() => {
              setConnectionString("");
              clearImportedFormValues();
              closeModal(HomePanels.NewConnection);
            }}
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void handleTest()}
              disabled={
                isTesting ||
                isCreatingSqlite ||
                isLoadingProfile ||
                isUnsupportedLegacyProfile ||
                (connectionTab === "ssh" && sshSource === null)
              }
            >
              Test
            </Button>
            {!isUnsupportedLegacyProfile && (
              <Button
                onClick={() => void handleConnect()}
                disabled={
                  isTesting ||
                  isCreatingSqlite ||
                  isLoadingProfile ||
                  (connectionTab === "ssh" && sshSource === null)
                }
              >
                {editingId ? "Save changes" : "Connect"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {isUnsupportedLegacyProfile ? (
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          This legacy connection format cannot be safely edited here. Its saved connection data is
          preserved; create a new profile to use structured connection fields.
        </div>
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <Field label="Connection Type">
            <Select
              options={connectionTypes}
              valueKey="value"
              value={connectionTypes.find((item) => item.value === displayedForm.dbType)}
              onValueChange={(value) => {
                if (!value) return;
                updateField("dbType", value.value as ConnectionFormValues["dbType"]);
                if (value.value === "sqlite") setConnectionTab("normal");
              }}
              render={(option) => <ConnectionTypeOption type={option} />}
              placeholder="Select type"
            />
          </Field>

          <Tabs
            value={connectionTab}
            onValueChange={(value) => setConnectionTab(value as ConnectionTab)}
            className="gap-4"
          >
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="normal" className="flex-1">
                Normal connection
              </TabsTrigger>
              <TabsTrigger value="ssh" disabled={displayedForm.dbType === "sqlite"} className="flex-1">
                <RiTerminalBoxLine data-icon="inline-start" aria-hidden="true" />
                SSH tunnel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="normal" className="grid gap-4">
              {displayedForm.dbType === "sqlite" ? (
                <SqliteConnectionFields
                  path={displayedForm.sqlitePath}
                  onPathChange={(path) => updateField("sqlitePath", path)}
                  onCreate={handleCreateSqliteDatabase}
                  isCreating={isCreatingSqlite}
                  disabled={isTesting || isLoadingProfile}
                />
              ) : (
                <DatabaseConnectionFields values={displayedForm} onChange={updateField} />
              )}
            </TabsContent>

            <TabsContent value="ssh" className="grid gap-4">
              {sshSource === null ? (
                <SshDestinationPicker aliases={sshAliases} onSourceChange={setSshSource} />
              ) : null}
              {sshSource !== null ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit px-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setSshSource(null)}
                  >
                    <RiArrowLeftLine data-icon="inline-start" />
                    Back to SSH destinations
                  </Button>
                  {sshSource === "manual" ? (
                    <ManualSshFields
                      values={manualSshValues}
                      authType={sshAuthType}
                      onAuthTypeChange={(value) => value && setSshAuthType(value)}
                      onChange={(field, value) =>
                        setManualSshValues((current) => ({ ...current, [field]: value }))
                      }
                    />
                  ) : null}
                  <DatabaseConnectionFields
                    values={displayedForm}
                    onChange={updateField}
                    showHost={sshSource === "manual"}
                    showSsl={sshSource === "manual"}
                  />
                </>
              ) : null}
            </TabsContent>
          </Tabs>

          {connectionTab !== "ssh" || sshSource !== null ? (
            <>
              <Field label="Connection name">
                <Input
                  iconLeft={RiDatabase2Line}
                  placeholder="Production database"
                  value={displayedForm.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </Field>

              <div className="border-t border-border/70 pt-4">
                <Field label="Import connection string">
                  <div className="flex gap-2">
                    <PasswordInput
                      value={connectionString}
                      onChange={(event) => setConnectionString(event.target.value)}
                      placeholder="postgresql://user:password@host/database"
                    />
                    <Button
                      variant="outline"
                      onClick={handleImportConnectionString}
                      disabled={isTesting || isCreatingSqlite || isLoadingProfile}
                    >
                      Import
                    </Button>
                  </div>
                </Field>
              </div>
            </>
          ) : null}
        </div>
      )}

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

function createConnectionProfile(
  values: ConnectionFormValues,
  id: string | undefined,
  ssh: {
    enabled: boolean;
    source: SshSource;
    authType: string;
    manual: ManualSshValues;
  },
): ConnectionProfile {
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
    ssh_tunnel: ssh.enabled
      ? {
          source:
            ssh.source === "manual"
              ? {
                  type: "manual",
                  host: ssh.manual.host,
                  port: Number(ssh.manual.port),
                  user: ssh.manual.user,
                }
              : { type: "from_ssh_config", alias: ssh.source.alias },
          auth:
            ssh.authType === "password"
              ? { type: "password" }
              : { type: "key_file", path: ssh.manual.keyFile, passphrase_ref: null },
          remote_bind_host: values.host,
          remote_bind_port: Number(values.port),
        }
      : null,
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
      password: "",
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

function SqliteConnectionFields({
  path,
  onPathChange,
  onCreate,
  isCreating,
  disabled,
}: {
  path: string;
  onPathChange: (path: string) => void;
  onCreate: () => Promise<void>;
  isCreating: boolean;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-2">
      <FileField
        label="File path"
        placeholder="Select a SQLite database"
        value={path}
        onPathChange={onPathChange}
      />
      <Button
        variant="outline"
        className="w-full"
        onClick={() => void onCreate()}
        disabled={isCreating || disabled}
      >
        {isCreating ? "Creating database..." : "Create new SQLite database"}
      </Button>
    </div>
  );
}

function SshDestinationPicker({
  aliases,
  onSourceChange,
}: {
  aliases: string[];
  onSourceChange: (source: SshSource) => void;
}) {
  return (
    <div className="grid gap-2">
      <div>
        <p className="text-sm font-medium text-foreground">SSH destination</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose a host from your SSH config or enter its details manually.
        </p>
      </div>
          <div className="grid gap-2">
        {aliases.map((alias) => {
          return (
            <button
              key={alias}
              type="button"
              aria-pressed="false"
              onClick={() => onSourceChange({ type: "config", alias })}
              className="rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <RiTerminalBoxLine className="size-4 text-primary" aria-hidden="true" />
                {alias}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">SSH config host</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed="false"
          onClick={() => onSourceChange("manual")}
          className="rounded-lg border border-border border-dashed p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <RiServerLine className="size-4 text-primary" aria-hidden="true" />
            Manual
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">Enter SSH details</span>
        </button>
      </div>
      {aliases.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No SSH hosts were found in `~/.ssh/config`. Manual setup is available.
        </p>
      ) : null}
    </div>
  );
}

function ManualSshFields({
  values,
  authType,
  onAuthTypeChange,
  onChange,
}: {
  values: ManualSshValues;
  authType: string;
  onAuthTypeChange: (value: string | null) => void;
  onChange: <K extends keyof ManualSshValues>(field: K, value: ManualSshValues[K]) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <Field label="SSH host">
          <Input
            iconLeft={RiServerLine}
            value={values.host}
            onChange={(event) => onChange("host", event.target.value)}
            placeholder="ssh.example.com"
          />
        </Field>
        <Field label="Port">
          <Input
            iconLeft={RiGlobalLine}
            value={values.port}
            onChange={(event) => onChange("port", event.target.value)}
            placeholder="22"
            inputMode="numeric"
          />
        </Field>
      </div>

      <Field label="SSH user">
        <Input
          iconLeft={RiUserLine}
          value={values.user}
          onChange={(event) => onChange("user", event.target.value)}
          placeholder="SSH username"
        />
      </Field>

      <Field label="Authentication">
        <Select
          options={sshAuthTypes}
          valueKey="value"
          value={sshAuthTypes.find((option) => option.value === authType)}
          onValueChange={(option) => onAuthTypeChange(option?.value ?? null)}
          placeholder="Select authentication"
          className="h-10"
        />
      </Field>

      {authType === "key-file" ? (
        <FileField
          label="SSH key file"
          placeholder="Select SSH key"
          value={values.keyFile}
          onPathChange={(path) => onChange("keyFile", path)}
        />
      ) : (
        <Field label="SSH password">
          <PasswordInput
            iconLeft={RiLockPasswordLine}
            value={values.password}
            onChange={(event) => onChange("password", event.target.value)}
            placeholder="SSH password"
          />
        </Field>
      )}
    </div>
  );
}

function DatabaseConnectionFields({
  values,
  onChange,
  showHost = true,
  showSsl = true,
}: {
  values: ConnectionFormValues;
  onChange: <K extends keyof ConnectionFormValues>(
    field: K,
    value: ConnectionFormValues[K],
  ) => void;
  showHost?: boolean;
  showSsl?: boolean;
}) {
  return (
    <>
      <div className={showHost ? "grid grid-cols-[minmax(0,1fr)_7rem] gap-3" : "grid gap-3"}>
        {showHost ? (
          <Field label="Host">
            <Input
              iconLeft={RiServerLine}
              value={values.host}
              onChange={(event) => onChange("host", event.target.value)}
              placeholder="localhost"
            />
          </Field>
        ) : null}
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

      {showSsl ? (
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
      ) : null}

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
