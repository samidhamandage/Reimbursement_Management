"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Plus, GripVertical, Save, HandMetal, BadgeCheck, Info } from "lucide-react";
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
import { usersApi, rulesApi, User } from "@/lib/api";

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
  const [isActive, setIsActive] = useState(true);
  const [isManagerStep, setIsManagerStep] = useState(false);
  
  // New Conditional State
  const [enablePercentageRule, setEnablePercentageRule] = useState(false);
  const [minPercentage, setMinPercentage] = useState("100");
  const [enableSpecificRule, setEnableSpecificRule] = useState(false);
  const [specificApproverId, setSpecificApproverId] = useState<string>("none");
  
  const [approvers, setApprovers] = useState<{ id: string; userId: string; name: string }[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    usersApi.list().then(data => {
      setUsers(data.users.filter(u => u.role !== "EMPLOYEE"));
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setApprovers([...approvers, { id: `step-${Date.now()}`, userId, name: user.name }]);
  };

  // Live Rule Interpretation
  const ruleSummary = useMemo(() => {
    const totalPossible = approvers.length + (isManagerStep ? 1 : 0);
    const parts: string[] = ["Expense will be approved if"];
    
    const conditions: string[] = [];
    if (enablePercentageRule) {
      conditions.push(`${minPercentage}% of approvers (${Math.ceil((parseInt(minPercentage) / 100) * totalPossible)} / ${totalPossible}) approve`);
    }
    
    if (enableSpecificRule && specificApproverId !== "none") {
      const u = users.find(u => u.id === specificApproverId);
      conditions.push(`${u?.name || "Override Approver"} approves`);
    }

    if (conditions.length === 0) {
      return `Expense will be processed sequentially, step by step. Any rejection immediately rejects the expense.`;
    }

    return `${parts.join(" ")} ${conditions.join(" OR ")} — whichever fires first. Any single rejection will immediately reject the expense.`;
  }, [enablePercentageRule, minPercentage, enableSpecificRule, specificApproverId, approvers, isManagerStep, users]);

  const handleSave = async () => {
    if (!ruleName.trim()) {
      toast.error("Rule Name is required.");
      return;
    }
    
    setIsSaving(true);
    try {
      await rulesApi.create({
        name: ruleName,
        description,
        isActive,
        enablePercentageRule,
        minApprovalPercentage: parseInt(minPercentage),
        enableSpecificRule,
        specificApproverId: specificApproverId === "none" ? null : specificApproverId,
        includeDirectManager: isManagerStep,
        steps: approvers.map((a, index) => ({ order: index + 1, userId: a.userId })),
      });

      toast.success("Approval Rule Created!", {
        description: `Rule "${ruleName}" saved with conditional flow.`,
      });
      
      // Reset
      setRuleName("");
      setDescription("");
      setApprovers([]);
      setSpecificApproverId("none");
      setEnablePercentageRule(false);
      setEnableSpecificRule(false);
    } catch (error: any) {
      toast.error("Failed to save rule", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Approval Rule Engine</h2>
          <p className="text-sm text-muted-foreground">Configure multi-step workflows with thresholds and overrides.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Rule"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="bg-card/40 backdrop-blur-xl border-white/5 shadow-2xl">
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> Rule Definition
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g. High Value Tech Expenses" className="bg-background/50 border-white/10" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." rows={3} className="bg-background/50 border-white/10 resize-none" />
              </div>

              <div className="flex items-center justify-between p-3 border border-white/5 rounded-lg bg-white/5 mt-4">
                <div className="space-y-0.5">
                  <Label>Rule Active Status</Label>
                  <p className="text-xs text-muted-foreground">Automatically applies to new expenses when ON.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex items-center justify-between p-3 border border-white/5 rounded-lg bg-white/5">
                <div className="space-y-0.5">
                  <Label>Manager Step-In</Label>
                  <p className="text-xs text-muted-foreground">Auto-insert employee's manager at Step 1.</p>
                </div>
                <Switch checked={isManagerStep} onCheckedChange={setIsManagerStep} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-white/5 shadow-2xl">
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <HandMetal className="w-4 h-4 text-amber-500" /> Thresholds & Overrides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Percentage Rule */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">Enable Percentage Rule <BadgeCheck className="w-3 h-3 text-primary" /></Label>
                  <Switch checked={enablePercentageRule} onCheckedChange={setEnablePercentageRule} />
                </div>
                {enablePercentageRule && (
                  <div className="flex gap-2 items-center pl-4 border-l-2 border-primary/20">
                    <Input type="number" min="1" max="100" value={minPercentage} onChange={e => setMinPercentage(e.target.value)} className="bg-background/50 border-white/10 w-24" />
                    <span className="text-sm text-muted-foreground">% required for approval</span>
                  </div>
                )}
              </div>

              {/* Specific Override */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">Enable Specific Override <HandMetal className="w-3 h-3 text-amber-500" /></Label>
                  <Switch checked={enableSpecificRule} onCheckedChange={setEnableSpecificRule} />
                </div>
                {enableSpecificRule && (
                  <div className="space-y-2 pl-4 border-l-2 border-amber-500/20">
                    <Select value={specificApproverId} onValueChange={(v: string | null) => v && setSpecificApproverId(v)}>
                      <SelectTrigger className="bg-background/50 border-white/10">
                        <SelectValue placeholder="Select CFO/VP Approver..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Choose User...</SelectItem>
                        {users.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Real-time Summary */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3 items-start">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Rule Interpretation</p>
                  <p className="text-sm text-foreground/80 leading-relaxed italic">"{ruleSummary}"</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card/40 backdrop-blur-xl border-white/5 h-full flex flex-col shadow-2xl">
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-lg">Approval Sequence Config</CardTitle>
              <CardDescription>Drag the sequence to reorder hierarchy dynamically.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 flex-1 flex flex-col space-y-6">
              <div className="flex gap-2">
                <Select onValueChange={(v: string | null) => v && handleAddApprover(v)}>
                  <SelectTrigger className="bg-background/50 border-white/10 flex-1">
                    <SelectValue placeholder="Add sequential approver..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="shrink-0 border-white/10 bg-white/5"><Plus className="w-4 h-4" /></Button>
              </div>

              <div className="flex-1 min-h-[400px] p-4 bg-white/5 border border-white/10 border-dashed rounded-xl">
                {isManagerStep && (
                  <div className="flex items-center gap-3 p-3 mb-4 bg-primary/10 border border-primary/20 rounded-lg shadow-inner">
                    <BadgeCheck className="w-4 h-4 text-primary" />
                    <div className="font-medium text-sm flex-1 text-primary">Direct Manager (Lock Step #1)</div>
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

                {approvers.length === 0 && !isManagerStep && (
                  <div className="h-full flex flex-col items-center justify-center opacity-40 py-24 text-center">
                    <GripVertical className="w-8 h-8 mb-4 opacity-50" />
                    <p className="text-sm">No static steps configured.<br/>Add approvers from the dropdown.</p>
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
