import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/animate-ui/components/radix/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Panel } from "@/shared/components/panel";
import { useModalStore } from "@/shared/store/modalStore";
import { useState } from "react";
import { HomePanels } from "../lib/home-panels";
import { newConnectionSchema } from "../schemas/connectionSchema";

export function NewConnectionPanel() {
  const closeModal = useModalStore((state) => state.closeModal);
  const [sslEnabled, setSslEnabled] = useState(false);
  const [sshEnabled, setSshEnabled] = useState(false);

  void newConnectionSchema;

  return (
    <Panel
      panelId={HomePanels.NewConnection}
      title="New Connection"
      description="Create a reusable connection from the dashboard."
      className="w-140"
    >
      <NewConnectionPanelBody
        sslEnabled={sslEnabled}
        sshEnabled={sshEnabled}
        onSslChange={setSslEnabled}
        onSshChange={setSshEnabled}
      />
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

function NewConnectionPanelBody({
  sslEnabled,
  sshEnabled,
  onSslChange,
  onSshChange,
}: {
  sslEnabled: boolean;
  sshEnabled: boolean;
  onSslChange: (value: boolean) => void;
  onSshChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="grid gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">Connection Type</span>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mysql">MySQL</SelectItem>
              <SelectItem value="postgresql">PostgreSQL</SelectItem>
              <SelectItem value="sqlite">SQLite</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <Field label="Authentication Method" value="Username / Password" />
        <Field label="Connection Mode" value="Host and Port" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input placeholder="localhost" />
        </div>
        <Input placeholder="5432" />
      </div>

      <Accordion>
        <AccordionItem value="ssl">
          <AccordionTrigger className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <span className="flex w-full items-center justify-between text-left">
              <span className="font-medium text-foreground">Enable SSL</span>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  onSslChange(!sslEnabled);
                }}
                className={`size-4 rounded-full border ${sslEnabled ? "border-primary bg-primary" : "border-border bg-background"}`}
                aria-label="Enable SSL"
              />
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 pt-1">
              <Input placeholder="SSL mode" />
              <Input placeholder="Certificate path" />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="User" />
        <Input placeholder="Password" />
      </div>

      <Input placeholder="Default Database" />

      <Accordion>
        <AccordionItem value="ssh">
          <AccordionTrigger className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <span className="flex w-full items-center justify-between text-left">
              <span className="font-medium text-foreground">SSH Tunnel</span>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  onSshChange(!sshEnabled);
                }}
                className={`size-4 rounded-full border ${sshEnabled ? "border-primary bg-primary" : "border-border bg-background"}`}
                aria-label="SSH Tunnel"
              />
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 pt-1">
              <Input placeholder="SSH host" />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="SSH port" />
                <Input placeholder="SSH user" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" className="size-4 rounded border-border" />
        Read Only Mode
      </label>

      <div className="border-t border-border pt-4">
        <div className="mb-3 text-sm font-medium text-foreground">Save Connection</div>
        <Input placeholder="Connection Name" />
        <div className="mt-3 flex items-center gap-3">
          <input
            type="checkbox"
            defaultChecked
            className="size-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-muted-foreground">Save Passwords</span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Input value={value} readOnly />
    </label>
  );
}
