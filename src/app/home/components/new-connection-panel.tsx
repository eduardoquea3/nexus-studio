import { useGSAP } from "@gsap/react";
import {
  RiArrowLeftLine,
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
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { save } from "@tauri-apps/plugin-dialog";
import gsap from "gsap";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ConnectionProfile, DbType, SshTunnelConfig } from "@/shared/types/models";

import { connectionsQueryKey } from "@/app/home/hooks/use-connections";
import {
  getConnectionSessionKey,
  isUnsupportedLegacyConnection,
  shouldLoadConnectionProfile,
  shouldResetConnectionSession,
} from "@/app/home/lib/connection-panel-state";
import { parseConnectionString } from "@/app/home/lib/connection-string-parser";
import {
  addConnectionTag,
  CONNECTION_TAG_COLORS,
  getAvailableConnectionTags,
  getConnectionTagColor,
} from "@/app/home/lib/connection-tags";
import { getConnection } from "@/app/home/services/connection-service";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/animate-ui/components/radix/accordion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Field } from "@/shared/components/ui/field";
import { FileField } from "@/shared/components/ui/file-field";
import { Input, type InputProps } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { createConnectionId, DuplicateConnectionError } from "@/shared/lib/connection-identity";
import {
  saveConnection,
  createSqliteDatabase,
  testConnectionFields,
  listSshConfigHosts,
  storeSshPassword,
  deleteSshPassword,
  type SshConfigHost,
  type ConnectionTestRequest,
} from "@/shared/lib/tauriApi";
import { useConnectionStore } from "@/shared/store/connectionStore";

gsap.registerPlugin(useGSAP);

const sshAuthTypes = [
  { value: "key-file", label: "Key file" },
  { value: "password", label: "User and password" },
] as const;

type ConnectionFormValues = {
  dbType: "postgresql" | "mysql" | "sqlite";
  name: string;
  tags: string[];
  tagColor: string;
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
  credentialRef: string | null;
};

type ConnectionFeedback = {
  type: "success" | "error";
  title: string;
  description: string;
};

const initialFormValues: ConnectionFormValues = {
  dbType: "postgresql",
  name: "",
  tags: [],
  tagColor: "primary",
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
  credentialRef: null,
};

type NewConnectionPanelProps = {
  editingId?: string;
  initialDbType?: ConnectionFormValues["dbType"];
  onCancel: () => void;
};

export function NewConnectionPanel({
  editingId,
  initialDbType = "postgresql",
  onCancel,
}: NewConnectionPanelProps) {
  const navigate = useNavigate();
  const addProfile = useConnectionStore((state) => state.addProfile);
  const updateProfile = useConnectionStore((state) => state.updateProfile);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => ({ ...initialFormValues, dbType: initialDbType }));
  const [tagInput, setTagInput] = useState("");
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [activeTagOption, setActiveTagOption] = useState(0);
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const tagSuggestionsRef = useRef<HTMLDivElement>(null);
  const [connectionString, setConnectionString] = useState("");
  const [sshAuthType, setSshAuthType] = useState("key-file");
  const [connectionTab, setConnectionTab] = useState<ConnectionTab>("normal");
  const [sshHosts, setSshHosts] = useState<SshConfigHost[]>([]);
  const [sshSource, setSshSource] = useState<SshSource | null>(null);
  const [manualSshValues, setManualSshValues] = useState(initialManualSshValues);
  const [isTesting, setIsTesting] = useState(false);
  const [isCreatingSqlite, setIsCreatingSqlite] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [feedback, setFeedback] = useState<ConnectionFeedback | null>(null);
  const [unsupportedLegacyProfileId, setUnsupportedLegacyProfileId] = useState<string>();
  const sessionKey = getConnectionSessionKey(true, editingId);
  const sessionKeyRef = useRef<string | null>(null);
  const loadedProfileSessionKeyRef = useRef<string | null>(null);
  const importedFieldsRef = useRef<(keyof ConnectionFormValues)[]>([]);
  const isConnectingRef = useRef(false);
  const isCurrentSession = sessionKeyRef.current === sessionKey;
  const isUnsupportedLegacyProfile =
    isCurrentSession && editingId !== undefined && unsupportedLegacyProfileId === editingId;
  const displayedForm = isCurrentSession ? form : initialFormValues;
  const savedProfiles = queryClient.getQueryData<ConnectionProfile[]>(connectionsQueryKey) ?? [];
  const availableTags = useMemo(() => getAvailableConnectionTags(savedProfiles), [savedProfiles]);
  const tagOptions = useMemo(
    () =>
      availableTags.filter(
        (tag) =>
          !displayedForm.tags.some(
            (selected) => selected.toLocaleLowerCase() === tag.toLocaleLowerCase(),
          ) && tag.toLocaleLowerCase().includes(tagInput.trim().toLocaleLowerCase()),
      ),
    [availableTags, displayedForm.tags, tagInput],
  );
  const canCreateTag =
    tagInput.trim().length > 0 &&
    !availableTags.some((tag) => tag.toLocaleLowerCase() === tagInput.trim().toLocaleLowerCase()) &&
    !displayedForm.tags.some(
      (tag) => tag.toLocaleLowerCase() === tagInput.trim().toLocaleLowerCase(),
    );
  const addTag = (value = tagInput) => {
    setForm((current) => ({ ...current, tags: addConnectionTag(current.tags, value) }));
    setTagInput("");
    setIsTagPickerOpen(false);
  };

  useEffect(() => {
    if (!isTagPickerOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !tagPickerRef.current?.contains(event.target)) {
        setIsTagPickerOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isTagPickerOpen]);

  useGSAP(
    () => {
      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) return;

      if (isTagPickerOpen && tagSuggestionsRef.current) {
        const suggestions = tagSuggestionsRef.current;
        gsap.fromTo(
          suggestions,
          { autoAlpha: 0, y: -6, scale: 0.985 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: "power2.out" },
        );
        gsap.fromTo(
          suggestions.querySelectorAll("[data-tag-option]"),
          { autoAlpha: 0, y: 4 },
          { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.025, ease: "power2.out" },
        );
      }

      const chips = tagPickerRef.current?.querySelectorAll("[data-selected-tag]");
      if (chips?.length) {
        gsap.fromTo(
          chips,
          { autoAlpha: 0, scale: 0.92, y: 3 },
          { autoAlpha: 1, scale: 1, y: 0, duration: 0.18, stagger: 0.035, ease: "back.out(1.5)" },
        );
      }
    },
    {
      scope: tagPickerRef,
      dependencies: [isTagPickerOpen, tagOptions, canCreateTag, displayedForm.tags],
      revertOnUpdate: true,
    },
  );

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
    if (shouldResetConnectionSession(sessionKeyRef.current, sessionKey)) {
      sessionKeyRef.current = sessionKey;
      setForm({ ...initialFormValues, dbType: initialDbType });
      setTagInput("");
      setConnectionString("");
      setSshAuthType("key-file");
      setConnectionTab("normal");
      setSshSource(null);
      setManualSshValues(initialManualSshValues);
      setFeedback(null);
      setUnsupportedLegacyProfileId(undefined);
      loadedProfileSessionKeyRef.current = null;
      importedFieldsRef.current = [];
    }
  }, [initialDbType, sessionKey]);

  useEffect(() => {
    let cancelled = false;

    if (
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
            if (auth.type === "password") {
              setManualSshValues((current) => ({
                ...current,
                credentialRef: auth.credential_ref ?? null,
              }));
            } else {
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
  }, [editingId, sessionKey]);

  useEffect(() => {
    let cancelled = false;
    void listSshConfigHosts()
      .then((hosts) => {
        if (!cancelled) setSshHosts(hosts);
      })
      .catch(() => {
        if (!cancelled) setSshHosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = <K extends keyof ConnectionFormValues>(
    field: K,
    value: ConnectionFormValues[K],
  ) => {
    setFeedback(null);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateManualSshField = <K extends keyof ManualSshValues>(
    field: K,
    value: ManualSshValues[K],
  ) => {
    setFeedback(null);
    setManualSshValues((current) => ({ ...current, [field]: value }));
  };

  const getSshTunnelConfig = (): SshTunnelConfig | undefined => {
    if (connectionTab !== "ssh" || sshSource === null) return undefined;

    return {
      source:
        sshSource === "manual"
          ? {
              type: "manual",
              host: manualSshValues.host,
              port: Number(manualSshValues.port),
              user: manualSshValues.user,
            }
          : { type: "from_ssh_config", alias: sshSource.alias },
      auth:
        sshAuthType === "password"
          ? { type: "password", credential_ref: manualSshValues.credentialRef }
          : { type: "key_file", path: manualSshValues.keyFile, passphrase_ref: null },
      remote_bind_host: form.host,
      remote_bind_port: Number(form.port),
    };
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
      ssh: getSshTunnelConfig(),
      sshPassword:
        sshSource === "manual" && sshAuthType === "password"
          ? manualSshValues.password || undefined
          : undefined,
      connectionId: editingId,
    }) as const;

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const request = getTestRequest();
      console.info("[connection-test] target", formatConnectionTarget(request));
      const message = await testConnectionFields(request);
      setFeedback({ type: "success", title: "Connection successful", description: message });
    } catch (error) {
      setFeedback({ type: "error", title: "Connection failed", description: String(error) });
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

  const handleConnect = async (testBeforeSave = true) => {
    if (isConnectingRef.current) return;

    if (!form.name.trim()) {
      setFeedback({
        type: "error",
        title: "Connection name is required",
        description: "Enter a name before saving the connection.",
      });
      return;
    }
    if (connectionTab === "ssh" && sshSource === null) {
      setFeedback({
        type: "error",
        title: "Choose an SSH destination",
        description: "Select an SSH config host or choose Manual before connecting.",
      });
      return;
    }
    if (connectionTab === "ssh" && sshSource !== "manual" && sshAuthType === "password") {
      setFeedback({
        type: "error",
        title: "Choose a manual SSH destination",
        description:
          "SSH password authentication is available for manual destinations. Use a key or agent for SSH config aliases.",
      });
      return;
    }
    if (
      connectionTab === "ssh" &&
      sshSource === "manual" &&
      sshAuthType === "password" &&
      !manualSshValues.password &&
      !manualSshValues.credentialRef
    ) {
      setFeedback({
        type: "error",
        title: "SSH password is required",
        description: "Enter an SSH password before saving this connection.",
      });
      return;
    }
    if (isUnsupportedLegacyProfile) {
      setFeedback({
        type: "error",
        title: "Connection cannot be edited",
        description: "This legacy connection format is preserved and cannot be safely edited here.",
      });
      return;
    }

    isConnectingRef.current = true;
    setIsTesting(true);
    let newCredentialRef: string | null = null;
    let profileSaved = false;
    try {
      if (testBeforeSave) {
        await testConnectionFields(getTestRequest());
      }

      let credentialRef = manualSshValues.credentialRef;
      if (connectionTab === "ssh" && sshSource === "manual" && sshAuthType === "password") {
        if (manualSshValues.password) {
          credentialRef = crypto.randomUUID();
          newCredentialRef = credentialRef;
          await storeSshPassword(credentialRef, manualSshValues.password);
        }
      } else {
        credentialRef = null;
      }

      const profileDraft = createConnectionProfile(
        form,
        editingId ?? "",
        {
          enabled: connectionTab === "ssh",
          source: sshSource ?? "manual",
          authType: sshAuthType,
          manual: manualSshValues,
        },
        credentialRef,
      );
      const profile = editingId
        ? profileDraft
        : { ...profileDraft, id: await createConnectionId(profileDraft) };
      const profileToSave = editingId ? profile : { ...profile, last_opened_at: Date.now() };
      await saveConnection(profileToSave, editingId ? "update" : "create");
      profileSaved = true;
      setManualSshValues((current) => ({
        ...current,
        password: "",
        credentialRef,
      }));

      if (manualSshValues.credentialRef && manualSshValues.credentialRef !== credentialRef) {
        try {
          await deleteSshPassword(manualSshValues.credentialRef);
        } catch (cleanupError) {
          console.warn("Could not remove a replaced SSH credential", cleanupError);
        }
      }

      if (editingId) {
        updateProfile(profileToSave);
        await queryClient.invalidateQueries({ queryKey: connectionsQueryKey });
        if (testBeforeSave) {
          setFeedback({
            type: "success",
            title: "Connection updated",
            description: "The connection profile and its credentials were saved locally.",
          });
        } else {
          await navigate({ to: "/" });
        }
      } else {
        addProfile(profileToSave);
        void queryClient
          .invalidateQueries({ queryKey: connectionsQueryKey })
          .catch((error: unknown) => {
            console.warn("Could not refresh saved connections", error);
          });
        const destination = testBeforeSave
          ? navigate({
              to: "/connections/$connectionId",
              params: { connectionId: profileToSave.id },
            })
          : navigate({ to: "/" });
        void destination.catch((error: unknown) => {
          toast.add({
            title: testBeforeSave
              ? "Connection saved but could not be opened"
              : "Connection saved but could not return to the list",
            type: "error",
            description: String(error),
          });
        });
      }
    } catch (error) {
      if (newCredentialRef && !profileSaved) {
        try {
          await deleteSshPassword(newCredentialRef);
        } catch (cleanupError) {
          console.warn("Could not clean up an unsaved SSH credential", cleanupError);
        }
      }
      const isDuplicateConnection = error instanceof DuplicateConnectionError;
      setFeedback({
        type: "error",
        title: isDuplicateConnection ? "Connection already exists" : "Could not save connection",
        description: isDuplicateConnection ? error.message : String(error),
      });
    } finally {
      isConnectingRef.current = false;
      setIsTesting(false);
    }
  };

  return (
    <main className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden px-5 py-6 text-foreground sm:px-8 sm:py-8">
      <header className="mb-5 flex items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
            {editingId ? "Connection profile" : "New connection"}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {editingId ? "Edit Connection" : "Configure connection"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {editingId ? "Update the saved connection profile." : "Set up a reusable database connection."}
          </p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          <RiArrowLeftLine data-icon="inline-start" aria-hidden="true" />
          Cancel
        </Button>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-3xl py-2">
          <div className="flex min-h-full flex-col gap-4 text-sm">
        {isUnsupportedLegacyProfile ? (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            This legacy connection format cannot be safely edited here. Its saved connection data is
            preserved; create a new profile to use structured connection fields.
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 text-sm">
            <Tabs
              value={connectionTab}
              onValueChange={(value) => {
                setFeedback(null);
                setConnectionTab(value as ConnectionTab);
              }}
              className="gap-4"
            >
              <TabsList variant="line" className="w-full">
                <TabsTrigger value="normal" className="flex-1">
                  Normal connection
                </TabsTrigger>
                <TabsTrigger
                  value="ssh"
                  disabled={displayedForm.dbType === "sqlite"}
                  className="flex-1"
                >
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
                  <SshDestinationPicker
                    hosts={sshHosts}
                    onSourceChange={(source) => {
                      setFeedback(null);
                      setSshSource(source);
                    }}
                  />
                ) : null}
                {sshSource !== null ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-fit px-0 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setFeedback(null);
                        setSshSource(null);
                      }}
                    >
                      <RiArrowLeftLine data-icon="inline-start" />
                      Back to SSH destinations
                    </Button>
                    {sshSource === "manual" ? (
                      <ManualSshFields
                        values={manualSshValues}
                        authType={sshAuthType}
                        onAuthTypeChange={(value) => {
                          if (!value) return;
                          setFeedback(null);
                          setSshAuthType(value);
                        }}
                        onChange={updateManualSshField}
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
                <Field label="Connection name *">
                  <Input
                    iconLeft={RiDatabase2Line}
                    placeholder="Production database"
                    value={displayedForm.name}
                    required
                    aria-required="true"
                    onChange={(event) => updateField("name", event.target.value)}
                  />
                </Field>

                <Field label="Tags">
                  <div ref={tagPickerRef} className="relative">
                    <Input
                      value={tagInput}
                      placeholder="Search or create a tag"
                      aria-label="Search or create a connection tag"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={isTagPickerOpen && (tagOptions.length > 0 || canCreateTag)}
                      aria-controls={
                        isTagPickerOpen && (tagOptions.length > 0 || canCreateTag)
                          ? "connection-tag-options"
                          : undefined
                      }
                      aria-activedescendant={
                        isTagPickerOpen && (tagOptions.length > 0 || canCreateTag)
                          ? `connection-tag-option-${activeTagOption}`
                          : undefined
                      }
                      onFocus={() => setIsTagPickerOpen(true)}
                      onChange={(event) => {
                        setTagInput(event.target.value);
                        setActiveTagOption(0);
                        setIsTagPickerOpen(true);
                      }}
                      onKeyDown={(event) => {
                        const optionCount = tagOptions.length + Number(canCreateTag);
                        if (event.key === "ArrowDown" && optionCount > 0) {
                          event.preventDefault();
                          setIsTagPickerOpen(true);
                          setActiveTagOption((index) => (index + 1) % optionCount);
                        } else if (event.key === "ArrowUp" && optionCount > 0) {
                          event.preventDefault();
                          setActiveTagOption((index) => (index - 1 + optionCount) % optionCount);
                        } else if (event.key === "Enter" || event.key === ",") {
                          event.preventDefault();
                          if (
                            isTagPickerOpen &&
                            optionCount > 0 &&
                            activeTagOption < tagOptions.length
                          ) {
                            addTag(tagOptions[activeTagOption]);
                          } else {
                            addTag();
                          }
                        } else if (event.key === "Escape") {
                          setIsTagPickerOpen(false);
                        }
                      }}
                    />
                    {isTagPickerOpen && (tagOptions.length > 0 || canCreateTag) ? (
                      <div
                        ref={tagSuggestionsRef}
                        id="connection-tag-options"
                        role="listbox"
                        aria-label="Tag suggestions"
                        className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-lg border border-border/80 bg-popover p-1.5 shadow-lg shadow-black/15"
                      >
                        {tagOptions.map((tag, index) => (
                          <div
                            key={tag}
                            id={`connection-tag-option-${index}`}
                            role="option"
                            tabIndex={-1}
                            aria-selected={activeTagOption === index}
                            data-tag-option
                            className="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent aria-selected:bg-accent"
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveTagOption(index)}
                            onClick={() => addTag(tag)}
                          >
                            <span>{tag}</span>
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              Existing
                            </span>
                          </div>
                        ))}
                        {canCreateTag ? (
                          <div
                            id={`connection-tag-option-${tagOptions.length}`}
                            role="option"
                            tabIndex={-1}
                            aria-selected={activeTagOption === tagOptions.length}
                            data-tag-option
                            className="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent aria-selected:bg-accent"
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveTagOption(tagOptions.length)}
                            onClick={() => addTag()}
                          >
                            <span>Create “{tagInput.trim()}”</span>
                            <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                              New tag
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {displayedForm.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {displayedForm.tags.map((tag) => {
                          const color = getConnectionTagColor(displayedForm.tagColor);
                          return (
                            <span
                              key={tag}
                              data-selected-tag
                              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
                              style={{
                                backgroundColor: `color-mix(in oklch, var(--${color}) 20%, var(--card))`,
                                borderColor: `color-mix(in oklch, var(--${color}) 55%, var(--border))`,
                                color: "var(--foreground)",
                              }}
                            >
                              {tag}
                              <button
                                type="button"
                                aria-label={`Remove ${tag} tag`}
                                className="ml-0.5 rounded-full px-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                                onClick={() =>
                                  updateField(
                                    "tags",
                                    displayedForm.tags.filter((item) => item !== tag),
                                  )
                                }
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </Field>

                <fieldset>
                  <legend className="mb-2 text-xs font-medium">Connection color</legend>
                  <div className="flex flex-wrap gap-2">
                    {CONNECTION_TAG_COLORS.map(({ value, label }) => (
                      <label key={value} className="cursor-pointer" title={label}>
                        <input
                          type="radio"
                          name="connection-tag-color"
                          value={value}
                          checked={getConnectionTagColor(displayedForm.tagColor) === value}
                          aria-label={`${label} theme color`}
                          className="peer sr-only"
                          onChange={() => updateField("tagColor", value)}
                        />
                        <span
                          aria-hidden="true"
                          className="block size-6 rounded-full border-2 border-background outline outline-1 outline-border transition-transform peer-checked:scale-110 peer-checked:outline-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-ring"
                          style={{ backgroundColor: `var(--${value})` }}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>

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

        <ConnectionFeedbackMessage feedback={feedback} />
        </div>
        </div>
      </ScrollArea>
      <footer className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-border/70 pt-4">
        <div className="flex items-center gap-2">
          {!isUnsupportedLegacyProfile && (
            <Button
              variant="outline"
              onClick={() => void handleConnect(false)}
              disabled={isTesting || isCreatingSqlite || isLoadingProfile}
            >
              Save
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => void handleTest()}
            disabled={isTesting || isCreatingSqlite || isLoadingProfile || isUnsupportedLegacyProfile || (connectionTab === "ssh" && sshSource === null)}
          >
            Test
          </Button>
          {!isUnsupportedLegacyProfile && (
            <Button
              onClick={() => void handleConnect()}
              disabled={isTesting || isCreatingSqlite || isLoadingProfile || (connectionTab === "ssh" && sshSource === null)}
            >
              {editingId ? "Save changes" : "Connect"}
            </Button>
          )}
        </div>
      </footer>
    </main>
  );
}

function ConnectionFeedbackMessage({ feedback }: { feedback: ConnectionFeedback | null }) {
  if (!feedback) return null;

  return (
    <div
      role={feedback.type === "error" ? "alert" : "status"}
      aria-live="polite"
      className={
        feedback.type === "error"
          ? "mt-auto mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          : "mt-auto mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"
      }
    >
      <p className="font-semibold">{feedback.title}</p>
      <p className="mt-1 break-words opacity-90">{feedback.description}</p>
    </div>
  );
}

function createConnectionProfile(
  values: ConnectionFormValues,
  id: string,
  ssh: {
    enabled: boolean;
    source: SshSource;
    authType: string;
    manual: ManualSshValues;
  },
  credentialRef: string | null,
): ConnectionProfile {
  const dbType: DbType = values.dbType === "postgresql" ? "postgres" : values.dbType;

  return {
    id,
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
    tags: values.tags,
    tag_color: values.tagColor,
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
              ? { type: "password", credential_ref: credentialRef }
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
      tags: profile.tags ?? [],
      tagColor: getConnectionTagColor(profile.tag_color),
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
    tags: profile.tags ?? [],
    tagColor: getConnectionTagColor(profile.tag_color),
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
  hosts,
  onSourceChange,
}: {
  hosts: SshConfigHost[];
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
        {hosts.map((host) => {
          return (
            <button
              key={host.alias}
              type="button"
              aria-pressed="false"
              onClick={() => onSourceChange({ type: "config", alias: host.alias })}
              className="rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <RiTerminalBoxLine className="size-4 text-primary" aria-hidden="true" />
                {host.alias}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{host.hostname}</span>
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
      {hosts.length === 0 ? (
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
        <div className="grid gap-1">
          <Field label="SSH password">
            <PasswordInput
              iconLeft={RiLockPasswordLine}
              value={values.password}
              onChange={(event) => onChange("password", event.target.value)}
              placeholder="SSH password"
            />
          </Field>
          {values.credentialRef && !values.password ? (
            <p className="text-xs text-muted-foreground">Leave blank to keep the saved password.</p>
          ) : null}
        </div>
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
