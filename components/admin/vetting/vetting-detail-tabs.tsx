'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { VettingOverviewTab } from './tabs/vetting-overview-tab';
import { VettingSectionsTab } from './tabs/vetting-sections-tab';
import { VettingOpponentsTab } from './tabs/vetting-opponents-tab';
import { VettingStageActionsTab } from './tabs/vetting-stage-actions-tab';
import { VettingBoardVoteTab } from './tabs/vetting-board-vote-tab';
import { VettingSurveyTab } from './tabs/vetting-survey-tab';
import type { VettingFullData, VettingPermissions, CommitteeMemberOption, SurveyResponseData } from './types';

interface VettingDetailTabsProps {
  vetting: VettingFullData;
  permissions: VettingPermissions;
  committeeMembers: CommitteeMemberOption[];
  surveyResponse: SurveyResponseData | null;
}

export function VettingDetailTabs({ vetting, permissions, committeeMembers, surveyResponse }: VettingDetailTabsProps) {
  const showBoardVote = vetting.stage === 'board_vote' || !!vetting.endorsed_at;

  return (
    <Tabs defaultValue="overview">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="survey">Survey</TabsTrigger>
        <TabsTrigger value="sections">Report Sections</TabsTrigger>
        <TabsTrigger value="opponents">Opponents</TabsTrigger>
        <TabsTrigger value="actions">Stage Actions</TabsTrigger>
        {showBoardVote && <TabsTrigger value="board-vote">Board Vote</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview">
        <VettingOverviewTab vetting={vetting} />
      </TabsContent>

      <TabsContent value="survey">
        <VettingSurveyTab surveyResponse={surveyResponse} />
      </TabsContent>

      <TabsContent value="sections">
        <VettingSectionsTab
          vettingId={vetting.id}
          sections={vetting.report_sections}
          permissions={permissions}
          committeeMembers={committeeMembers}
        />
      </TabsContent>

      <TabsContent value="opponents">
        <VettingOpponentsTab
          vettingId={vetting.id}
          opponents={vetting.opponents}
          permissions={permissions}
        />
      </TabsContent>

      <TabsContent value="actions">
        <VettingStageActionsTab
          vetting={vetting}
          permissions={permissions}
        />
      </TabsContent>

      {showBoardVote && (
        <TabsContent value="board-vote">
          <VettingBoardVoteTab
            vetting={vetting}
            permissions={permissions}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
