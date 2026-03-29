"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Plus, GripVertical, Save, HandMetal, BadgeCheck } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Basic mocks for users to populate dropdowns
const USERS = [
  { id: "u1", name: "Admin Setup", role: "ADMIN" },
  { id: "u2", name: "Sarah Manager", role: "MANAGER" },
  { id: "u3", name: "John Employee", role: "EMPLOYEE" },
  { id: "u4", name: "Finance Dept", role: "ADMIN" },
];

function SortableApproverItem({ id, approverName, onRemove }: { id: string; approverName: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 mb-2 bg-card border border-border rounded-md shadow-sm">
      <div {...attributes} {...listeners} className="cursor-grab hover:text-primary">
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="font-medium text-sm flex-1">{approverName}</div>
      <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive h-8 px-2 hover:bg-destructive/10">Remove</Button>
    </div>
  );
}

export function RuleBuilder() {
  const [ruleName, setRuleName] = useState("");
  const [description, setDescription] = useState("");
  const [approveExpenses, setApproveExpenses] = useState(true);
  const [isManagerApprover, setIsManagerApprover] = useState(false);
  const [minPercentage, setMinPercentage] = useState<string>("100");
  const [overrideApprover, setOverrideApprover] = useState<string>("none");
  const [approvers, setApprovers] = useState<{ id: string; userId: string; name: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setApprovers((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleAddApprover = (userId: string) => {
    if (!userId || userId === "none") return;
    const user = USERS.find(u => u.id === userId);
    if (!user) return;
    setApprovers([...approvers, { id: `step-\${Date.now()}`, userId, name: user.name }]);
  };

  const handleSave = async () => {
    if (!ruleName.trim()) {
      toast.error("Rule Name is required.");
      return;
    }
    
    setIsSaving(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      toast.success("Approval Rule Created!", {
        description: `Rule "\${ruleName}" saved successfully with \${approvers.length} dynamic steps.`,
      });
      // Reset
      setRuleName("");
      setDescription("");
      setApprovers([]);
      setOverrideApprover("none");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Approval Rule Engine</h2>
          <p className="text-sm text-muted-foreground">Configure complex multi-step custom workflows.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Rule"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Col: Basic Config */}
        <div className="space-y-6">
          <Card className="bg-card/40 backdrop-blur-xl border-white/5">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-lg flex items-center gap-2 pt-1">
                <Settings className="w-4 h-4 text-primary" /> Rule Definition
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g. High Value Tech Expenses" className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." rows={3} className="bg-background/50 resize-none" />
              </div>

              <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/20 mt-4">
                <div className="space-y-0.5">
                  <Label>Rule Active Status</Label>
                  <p className="text-xs text-muted-foreground">Turns rule on/off for incoming expenses.</p>
                </div>
                <Switch checked={approveExpenses} onCheckedChange={setApproveExpenses} />
              </div>

              <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/20">
                <div className="space-y-0.5">
                  <Label>Manager Step-In</Label>
                  <p className="text-xs text-muted-foreground">Auto-insert Employee's direct Manager directly at Step 1.</p>
                </div>
                <Switch checked={isManagerApprover} onCheckedChange={setIsManagerApprover} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-white/5">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-lg flex items-center gap-2 pt-1">
                <HandMetal className="w-4 h-4 text-amber-500" /> Thresholds & Overrides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label>Minimum Approval (%)</Label>
                <div className="flex gap-2 items-center">
                  <Input 
                    type="number" 
                    min="0" max="100" 
                    value={minPercentage} 
                    onChange={e => setMinPercentage(e.target.value)} 
                    className="bg-background/50 w-24" 
                  />
                  <span className="text-sm text-muted-foreground">% required of total sequence</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Specific Override Approver (CFO Mode)</Label>
                <p className="text-xs text-muted-foreground mb-2">If this user approves, the expense bypasses all other rules instantly.</p>
                <Select value={overrideApprover} onValueChange={setOverrideApprover}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Select approver..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {USERS.filter(u => u.role !== "EMPLOYEE").map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Sequence Builder */}
        <div className="space-y-6">
          <Card className="bg-card/40 backdrop-blur-xl border-white/5 h-full flex flex-col">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-lg">Approval Sequence Config</CardTitle>
              <CardDescription>Drag the sequence to reorder hierarchy dynamically.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 flex-1 flex flex-col">
              
              <div className="flex gap-2 mb-6">
                <Select onValueChange={handleAddApprover}>
                  <SelectTrigger className="bg-background/50 flex-1">
                    <SelectValue placeholder="Add sequential approver..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select User</SelectItem>
                    {USERS.filter(u => u.role !== "EMPLOYEE").map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" disabled className="shrink-0"><Plus className="w-4 h-4" /></Button>
              </div>

              <div className="flex-1 min-h-[300px] p-4 bg-muted/10 border border-border border-dashed rounded-lg">
                {isManagerApprover && (
                  <div className="flex items-center gap-3 p-3 mb-4 bg-primary/10 border border-primary/20 rounded-md shadow-sm">
                    <div className="w-5 h-5 flex items-center justify-center opacity-50"><BadgeCheck className="w-4 h-4" /></div>
                    <div className="font-medium text-sm flex-1 text-primary">Direct Manager (Auto-Assigned - Lock Step #1)</div>
                  </div>
                )}
                
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={approvers.map(a => a.id)} strategy={verticalListSortingStrategy}>
                    {approvers.map((approver) => (
                      <SortableApproverItem 
                        key={approver.id} 
                        id={approver.id} 
                        approverName={approver.name} 
                        onRemove={() => setApprovers(items => items.filter(i => i.id !== approver.id))} 
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {approvers.length === 0 && !isManagerApprover && (
                  <div className="h-full flex flex-col items-center justify-center opacity-40 py-12 text-center text-sm">
                    <GripVertical className="w-8 h-8 mb-4 border rounded p-1" />
                    No static steps configured.<br/>Add approvers from the dropdown.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
