import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function PatientHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <span className="text-sm text-muted-foreground">Portal do paciente</span>

      <div className="ml-auto flex items-center gap-2">
        <Avatar className="size-7">
          <AvatarFallback>P</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
