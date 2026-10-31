"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current";
import { prisma } from "@/server/db/client";
import { notifyUser } from "@/server/notifications";
import { ageBandFromBirth } from "@/server/identity/policy";
import { UNSEND_MS } from "@/lib/campus-loop";
import { saveUpload } from "@/server/media/storage";
import {
  applyQuietAccept,
  canRecommend,
  canSendFriendRequest,
  canUseQuietConnect,
  explainMatch,
  nextQuietStatus,
  parseTagList,
  quietLabel,
  type TagProfile,
} from "@/server/social/rules";
import { areFriends, blockedBetween, friendIds, sameInstitution } from "@/server/social/relations";
import { viewerCanSeeContent } from "@/server/academic/rules";

function refresh(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

async function profileTags(userId: string): Promise<TagProfile> {
  const [profile, communities] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.communityMember.findMany({
      where: { userId, pending: false },
      select: { communityId: true },
    }),
  ]);
  return {
    interests: profile?.interests ?? [],
    skills: profile?.skills ?? [],
    subjects: profile?.subjects ?? [],
    projectGoals: profile?.projectGoals ?? [],
    careerInterests: profile?.careerInterests ?? [],
    communityIds: communities.map((item) => item.communityId),
  };
}

export async function updateInterestsAction(formData: FormData) {
  const { userId } = await requireUser();
  await prisma.profile.update({
    where: { userId },
    data: {
      interests: parseTagList(String(formData.get("interests") ?? "")),
      skills: parseTagList(String(formData.get("skills") ?? "")),
      subjects: parseTagList(String(formData.get("subjects") ?? "")),
      projectGoals: parseTagList(String(formData.get("projectGoals") ?? "")),
      careerInterests: parseTagList(String(formData.get("careerInterests") ?? "")),
      studyPreference: String(formData.get("studyPreference") ?? "").slice(0, 120),
      allowFriendRequests: formData.get("allowFriendRequests") === "on",
    },
  });
  refresh(["/workspace/profile", "/workspace/people"]);
}

export async function listRecommendations() {
  const viewer = await requireUser();
  const [mine, hidden, skipped, friends, blocks] = await Promise.all([
    profileTags(viewer.userId),
    prisma.discoveryHide.findMany({ where: { userId: viewer.userId }, select: { hiddenUserId: true } }),
    prisma.discoverySkip.findMany({ where: { userId: viewer.userId }, select: { skippedUserId: true } }),
    friendIds(viewer.userId),
    prisma.block.findMany({
      where: { OR: [{ blockerId: viewer.userId }, { blockedId: viewer.userId }] },
      select: { blockerId: true, blockedId: true },
    }),
  ]);
  const hiddenIds = new Set(hidden.map((item) => item.hiddenUserId));
  const skippedIds = new Set(skipped.map((item) => item.skippedUserId));
  const friendSet = new Set(friends);
  const blockedIds = new Set(blocks.flatMap((item) => [item.blockerId, item.blockedId]));

  const candidates = await prisma.user.findMany({
    where: { id: { not: viewer.userId }, profile: { is: { discoverable: true } } },
    take: 200,
    select: {
      id: true,
      name: true,
      dateOfBirth: true,
      profile: true,
    },
  });

  const results = [];
  for (const candidate of candidates) {
    const band = ageBandFromBirth(new Date(candidate.dateOfBirth)) ?? "minor";
    const allowed = canRecommend({
      samePerson: false,
      viewerBand: viewer.band,
      candidateBand: band,
      candidateDiscoverable: Boolean(candidate.profile?.discoverable),
      blocked: blockedIds.has(candidate.id),
      hidden: hiddenIds.has(candidate.id),
      skipped: skippedIds.has(candidate.id),
      alreadyFriends: friendSet.has(candidate.id),
    });
    if (!allowed || !candidate.profile) {
      continue;
    }
    const tags = await profileTags(candidate.id);
    const match = explainMatch(mine, tags);
    if (match.score <= 0) {
      continue;
    }
    results.push({
      id: candidate.id,
      name: candidate.name,
      programme: candidate.profile.programme,
      score: match.score,
      reasons: match.reasons,
    });
  }

  return results.sort((left, right) => right.score - left.score).slice(0, 20);
}

export async function skipPersonAction(formData: FormData) {
  const { userId } = await requireUser();
  const skippedUserId = String(formData.get("userId") ?? "");
  await prisma.discoverySkip.upsert({
    where: { userId_skippedUserId: { userId, skippedUserId } },
    update: {},
    create: { userId, skippedUserId },
  });
  refresh(["/workspace/people"]);
}

export async function listClassmates() {
  const viewer = await requireUser();
  const mine = await prisma.enrollment.findMany({
    where: { userId: viewer.userId },
    select: { courseId: true },
  });
  const courseIds = mine.map((row) => row.courseId);
  if (courseIds.length === 0) {
    return [];
  }
  const rows = await prisma.enrollment.findMany({
    where: { courseId: { in: courseIds }, userId: { not: viewer.userId } },
    select: {
      course: { select: { title: true } },
      user: {
        select: {
          id: true,
          name: true,
          dateOfBirth: true,
          profile: { select: { discoverable: true, programme: true } },
        },
      },
    },
  });
  const friends = new Set(await friendIds(viewer.userId));
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewer.userId }, { blockedId: viewer.userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const hidden = await prisma.discoveryHide.findMany({
    where: { userId: viewer.userId },
    select: { hiddenUserId: true },
  });
  const blockedIds = new Set(blocks.flatMap((item) => [item.blockerId, item.blockedId]));
  const hiddenIds = new Set(hidden.map((item) => item.hiddenUserId));
  const grouped = new Map<string, { id: string; name: string; programme: string; courses: string[]; friend: boolean }>();
  for (const row of rows) {
    const band = ageBandFromBirth(new Date(row.user.dateOfBirth)) ?? "minor";
    const allowed = canRecommend({
      samePerson: false,
      viewerBand: viewer.band,
      candidateBand: band,
      candidateDiscoverable: Boolean(row.user.profile?.discoverable),
      blocked: blockedIds.has(row.user.id),
      hidden: hiddenIds.has(row.user.id),
      skipped: false,
      alreadyFriends: false,
    });
    if (!allowed) {
      continue;
    }
    const existing = grouped.get(row.user.id);
    if (existing) {
      if (!existing.courses.includes(row.course.title)) {
        existing.courses.push(row.course.title);
      }
      continue;
    }
    grouped.set(row.user.id, {
      id: row.user.id,
      name: row.user.name,
      programme: row.user.profile?.programme ?? "",
      courses: [row.course.title],
      friend: friends.has(row.user.id),
    });
  }
  return [...grouped.values()];
}

export async function hidePersonAction(formData: FormData) {
  const { userId } = await requireUser();
  const hiddenUserId = String(formData.get("userId") ?? "");
  await prisma.discoveryHide.upsert({
    where: { userId_hiddenUserId: { userId, hiddenUserId } },
    update: {},
    create: { userId, hiddenUserId },
  });
  refresh(["/workspace/people"]);
}

export async function sendFriendRequestAction(formData: FormData) {
  const viewer = await requireUser();
  const toUserId = String(formData.get("userId") ?? "");
  const target = await prisma.user.findUnique({
    where: { id: toUserId },
    include: { profile: true },
  });
  if (!target?.profile) {
    return;
  }
  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { fromUserId: viewer.userId, toUserId },
        { fromUserId: toUserId, toUserId: viewer.userId },
      ],
    },
  });
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.friendRequest.count({
    where: { fromUserId: viewer.userId, createdAt: { gte: since } },
  });
  const decision = canSendFriendRequest({
    samePerson: viewer.userId === toUserId,
    blocked: await blockedBetween(viewer.userId, toUserId),
    viewerBand: viewer.band,
    targetBand: ageBandFromBirth(new Date(target.dateOfBirth)) ?? "minor",
    targetAllowsRequests: target.profile.allowFriendRequests,
    existingStatus: existing ? (existing.status === "ACCEPTED" ? "ACCEPTED" : existing.status === "DECLINED" ? "DECLINED" : "PENDING") : "NONE",
    recentRequestCount: recent,
  });
  if (!decision.ok) {
    return;
  }
  if (existing?.status === "DECLINED") {
    await prisma.friendRequest.update({
      where: { id: existing.id },
      data: { fromUserId: viewer.userId, toUserId, status: "PENDING" },
    });
  } else {
    await prisma.friendRequest.create({
      data: { fromUserId: viewer.userId, toUserId, status: "PENDING" },
    });
  }
  await notifyUser({
    userId: toUserId,
    kind: "FRIEND_REQUEST",
    title: "New friend request",
    body: `${viewer.name} wants to connect.`,
    href: "/workspace/friends",
    preference: "notifyFriendRequests",
  });
  refresh(["/workspace/friends", "/workspace/people"]);
}

export async function respondFriendRequestAction(formData: FormData) {
  const viewer = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request || request.toUserId !== viewer.userId || request.status !== "PENDING") {
    return;
  }
  if (decision === "accept" && (await blockedBetween(request.fromUserId, request.toUserId))) {
    return;
  }
  await prisma.friendRequest.update({
    where: { id: request.id },
    data: { status: decision === "accept" ? "ACCEPTED" : "DECLINED" },
  });
  if (decision === "accept") {
    await notifyUser({
      userId: request.fromUserId,
      kind: "FRIEND_ACCEPTED",
      title: "Friend request accepted",
      body: `${viewer.name} accepted your request.`,
      href: "/workspace/friends",
      preference: "notifyFriendRequests",
    });
  }
  refresh(["/workspace/friends"]);
}

export async function cancelFriendRequestAction(formData: FormData) {
  const { userId } = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  await prisma.friendRequest.deleteMany({ where: { id: requestId, fromUserId: userId, status: "PENDING" } });
  refresh(["/workspace/friends"]);
}

export async function removeFriendAction(formData: FormData) {
  const { userId } = await requireUser();
  const otherId = String(formData.get("userId") ?? "");
  await prisma.friendRequest.deleteMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { fromUserId: userId, toUserId: otherId },
        { fromUserId: otherId, toUserId: userId },
      ],
    },
  });
  refresh(["/workspace/friends"]);
}

export async function blockPersonAction(formData: FormData) {
  const { userId } = await requireUser();
  const blockedId = String(formData.get("userId") ?? "");
  if (!blockedId || blockedId === userId) {
    return;
  }
  await prisma.$transaction([
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId } },
      update: {},
      create: { blockerId: userId, blockedId },
    }),
    prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: blockedId },
          { fromUserId: blockedId, toUserId: userId },
        ],
      },
    }),
  ]);
  refresh(["/workspace/friends", "/workspace/people", "/workspace/messages"]);
}

export async function unblockPersonAction(formData: FormData) {
  const { userId } = await requireUser();
  await prisma.block.deleteMany({
    where: { blockerId: userId, blockedId: String(formData.get("userId") ?? "") },
  });
  refresh(["/workspace/friends"]);
}

export async function reportPersonAction(formData: FormData) {
  const { userId } = await requireUser();
  const reason = String(formData.get("reason") ?? "").trim();
  const targetId = String(formData.get("targetId") ?? "");
  const targetType = String(formData.get("targetType") ?? "USER");
  if (reason.length < 5 || reason.length > 500 || !targetId) {
    return;
  }
  await prisma.report.create({
    data: { reporterId: userId, targetType, targetId, reason },
  });
  refresh(["/workspace/friends"]);
}

export async function listFriendDesk() {
  const { userId } = await requireUser();
  const [incoming, outgoing, friends, blocks] = await Promise.all([
    prisma.friendRequest.findMany({
      where: { toUserId: userId, status: "PENDING" },
      include: { fromUser: { select: { id: true, name: true } } },
    }),
    prisma.friendRequest.findMany({
      where: { fromUserId: userId, status: "PENDING" },
      include: { toUser: { select: { id: true, name: true } } },
    }),
    prisma.friendRequest.findMany({
      where: { status: "ACCEPTED", OR: [{ fromUserId: userId }, { toUserId: userId }] },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
    }),
    prisma.block.findMany({
      where: { blockerId: userId },
      include: { blocked: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    incoming,
    outgoing,
    friends: friends.map((row) => (row.fromUserId === userId ? row.toUser : row.fromUser)),
    blocks,
  };
}

export async function setQuietOptInAction(formData: FormData) {
  const viewer = await requireUser();
  if (viewer.band !== "adult") {
    return;
  }
  await prisma.quietProfile.upsert({
    where: { userId: viewer.userId },
    update: { optedIn: formData.get("optedIn") === "on", starters: String(formData.get("starters") ?? "").slice(0, 240) },
    create: {
      userId: viewer.userId,
      optedIn: formData.get("optedIn") === "on",
      starters: String(formData.get("starters") ?? "").slice(0, 240),
    },
  });
  refresh(["/workspace/quiet"]);
}

export async function matchQuietAction() {
  const viewer = await requireUser();
  const profile = await prisma.quietProfile.findUnique({ where: { userId: viewer.userId } });
  if (!canUseQuietConnect({ band: viewer.band, optedIn: Boolean(profile?.optedIn), blocked: false })) {
    redirect("/workspace/quiet?notice=opt-in");
  }
  const open = await prisma.quietIntroduction.findFirst({
    where: {
      status: { in: ["INTRODUCTION_CREATED", "ACTIVE", "REVEAL_REQUESTED", "REVEALED"] },
      OR: [{ userAId: viewer.userId }, { userBId: viewer.userId }],
    },
  });
  if (open) {
    redirect(`/workspace/quiet/${open.id}`);
  }
  const candidates = await prisma.quietProfile.findMany({
    where: { optedIn: true, userId: { not: viewer.userId } },
    include: { user: true },
    take: 50,
  });
  for (const candidate of candidates) {
    const band = ageBandFromBirth(new Date(candidate.user.dateOfBirth)) ?? "minor";
    if (!canUseQuietConnect({ band, optedIn: true, blocked: await blockedBetween(viewer.userId, candidate.userId) })) {
      continue;
    }
    const busy = await prisma.quietIntroduction.findFirst({
      where: {
        status: { in: ["INTRODUCTION_CREATED", "ACTIVE", "REVEAL_REQUESTED", "REVEALED"] },
        OR: [{ userAId: candidate.userId }, { userBId: candidate.userId }],
      },
      select: { id: true },
    });
    if (busy) {
      continue;
    }
    const created = await prisma.quietIntroduction.create({
      data: {
        userAId: viewer.userId,
        userBId: candidate.userId,
        status: "INTRODUCTION_CREATED",
        aliasA: `Cedar ${viewer.userId.slice(0, 4)}`,
        aliasB: `Maple ${candidate.userId.slice(0, 4)}`,
      },
    });
    redirect(`/workspace/quiet/${created.id}`);
  }
  redirect("/workspace/quiet?notice=waiting");
}

export async function quietAction(formData: FormData) {
  const viewer = await requireUser();
  const id = String(formData.get("id") ?? "");
  const event = String(formData.get("event") ?? "");
  const intro = await prisma.quietIntroduction.findUnique({ where: { id } });
  if (!intro || (intro.userAId !== viewer.userId && intro.userBId !== viewer.userId)) {
    return;
  }
  const viewerIsA = intro.userAId === viewer.userId;
  if (event === "ACCEPT") {
    const next = applyQuietAccept(intro.status, viewerIsA, intro.acceptedA, intro.acceptedB);
    if (!next) {
      return;
    }
    await prisma.quietIntroduction.update({ where: { id }, data: next });
  } else if (event === "ASK_REVEAL") {
    const status = nextQuietStatus(intro.status, "ASK_REVEAL", true);
    if (!status) {
      return;
    }
    await prisma.quietIntroduction.update({
      where: { id },
      data: { status, revealAskedById: viewer.userId },
    });
  } else if (event === "CONSENT_REVEAL" || event === "REJECT_REVEAL" || event === "END" || event === "DECLINE" || event === "REPORT") {
    const actorIsRequester = intro.revealAskedById === viewer.userId;
    const status = nextQuietStatus(intro.status, event, actorIsRequester);
    if (!status) {
      return;
    }
    await prisma.quietIntroduction.update({ where: { id }, data: { status } });
    if (event === "REPORT") {
      await prisma.report.create({
        data: {
          reporterId: viewer.userId,
          targetType: "QUIET",
          targetId: id,
          reason: String(formData.get("reason") ?? "Reported from Quiet Connect").slice(0, 500),
        },
      });
    }
  }
  refresh([`/workspace/quiet/${id}`, "/workspace/quiet"]);
}

export async function sendQuietMessageAction(formData: FormData) {
  const viewer = await requireUser();
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const intro = await prisma.quietIntroduction.findUnique({ where: { id } });
  if (!intro || !body || body.length > 1000) {
    return;
  }
  if (intro.userAId !== viewer.userId && intro.userBId !== viewer.userId) {
    return;
  }
  if (!["ACTIVE", "REVEAL_REQUESTED", "REVEALED"].includes(intro.status)) {
    return;
  }
  await prisma.quietMessage.create({ data: { introductionId: id, senderId: viewer.userId, body } });
  refresh([`/workspace/quiet/${id}`]);
}

export async function loadQuiet(id: string) {
  const viewer = await requireUser();
  const intro = await prisma.quietIntroduction.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      userA: { select: { id: true, name: true } },
      userB: { select: { id: true, name: true } },
    },
  });
  if (!intro || (intro.userAId !== viewer.userId && intro.userBId !== viewer.userId)) {
    return null;
  }
  const viewerIsA = intro.userAId === viewer.userId;
  return {
    id: intro.id,
    status: intro.status,
    label: quietLabel({
      status: intro.status,
      viewerIsA,
      aliasA: intro.aliasA,
      aliasB: intro.aliasB,
      nameA: intro.userA.name,
      nameB: intro.userB.name,
    }),
    starters: (
      await prisma.quietProfile.findUnique({
        where: { userId: viewerIsA ? intro.userBId : intro.userAId },
        select: { starters: true },
      })
    )?.starters ?? "",
    viewerAccepted: viewerIsA ? intro.acceptedA : intro.acceptedB,
    partnerAccepted: viewerIsA ? intro.acceptedB : intro.acceptedA,
    revealAskedByViewer: intro.revealAskedById === viewer.userId,
    messages: intro.messages.map((message) => ({
      id: message.id,
      mine: message.senderId === viewer.userId,
      body: message.body,
      createdAt: message.createdAt,
    })),
  };
}

export async function listMessages() {
  const { userId } = await requireUser();
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: { include: { user: { select: { id: true, name: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  return memberships.map((membership) => ({
    id: membership.conversation.id,
    title:
      membership.conversation.kind === "GROUP"
        ? membership.conversation.title
        : membership.conversation.members.find((member) => member.userId !== userId)?.user.name ?? "Conversation",
    preview: membership.conversation.messages[0]?.deletedAt ? "Message deleted" : membership.conversation.messages[0]?.body ?? "No messages yet",
    muted: membership.muted,
    kind: membership.conversation.kind,
    at: membership.conversation.messages[0]?.createdAt.toISOString() ?? membership.conversation.createdAt.toISOString(),
    unread: Boolean(
      membership.conversation.messages[0] &&
        membership.conversation.messages[0].senderId !== userId &&
        !membership.conversation.messages[0].deletedAt &&
        (!membership.lastReadAt || membership.conversation.messages[0].createdAt > membership.lastReadAt),
    ),
  })).sort((left, right) => Number(right.unread) - Number(left.unread) || right.at.localeCompare(left.at));
}

export async function startDirectMessageAction(formData: FormData) {
  const viewer = await requireUser();
  const otherId = String(formData.get("userId") ?? "");
  if (!(await areFriends(viewer.userId, otherId)) || (await blockedBetween(viewer.userId, otherId))) {
    return;
  }
  const existing = await prisma.conversation.findFirst({
    where: {
      kind: "DIRECT",
      AND: [
        { members: { some: { userId: viewer.userId } } },
        { members: { some: { userId: otherId } } },
      ],
    },
  });
  if (existing) {
    redirect(threadPath(formData, existing.id));
  }
  const created = await prisma.conversation.create({
    data: {
      kind: "DIRECT",
      createdById: viewer.userId,
      members: { create: [{ userId: viewer.userId }, { userId: otherId }] },
    },
  });
  redirect(threadPath(formData, created.id));
}

function threadPath(formData: FormData, id: string) {
  return String(formData.get("surface") ?? "") === "connect" ? `/workspace/connect/chat/${id}` : `/workspace/messages/${id}`;
}

export async function createGroupAction(formData: FormData) {
  const viewer = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const ids = [
    ...formData.getAll("memberId").map((item) => String(item).trim()),
    ...String(formData.get("memberIds") ?? "")
      .split(",")
      .map((item) => item.trim()),
  ].filter(Boolean);
  if (title.length < 2) {
    return;
  }
  const unique = [...new Set([viewer.userId, ...ids])];
  for (const memberId of unique) {
    if (memberId !== viewer.userId && (await blockedBetween(viewer.userId, memberId))) {
      return;
    }
  }
  const created = await prisma.conversation.create({
    data: {
      kind: "GROUP",
      title,
      createdById: viewer.userId,
      members: { create: unique.map((userId) => ({ userId })) },
    },
  });
  redirect(`/workspace/messages/${created.id}`);
}

export async function loadConversation(id: string, query = "") {
  const { userId } = await requireUser();
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId } },
  });
  if (!membership) {
    return null;
  }
  const now = new Date();
  const due = await prisma.message.findMany({
    where: { conversationId: id, notified: false, visibleAt: { lte: now }, deletedAt: null },
  });
  for (const message of due) {
    const members = await prisma.conversationMember.findMany({ where: { conversationId: id } });
    for (const member of members) {
      if (member.userId !== message.senderId && !member.muted) {
        await notifyUser({
          userId: member.userId,
          kind: "MESSAGE",
          title: "New message",
          body: "A scheduled message has arrived.",
          href: `/workspace/messages/${id}`,
          preference: "notifyMessages",
        });
      }
    }
    await prisma.message.update({ where: { id: message.id }, data: { notified: true } });
  }
  const needle = query.trim();
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        where: {
          AND: [
            { OR: [{ visibleAt: { lte: now } }, { senderId: userId }] },
            needle ? { body: { contains: needle, mode: "insensitive" } } : {},
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 100,
        include: {
          sender: { select: { id: true, name: true } },
          reactions: true,
          parent: { select: { body: true, sender: { select: { name: true } } } },
          poll: { include: { options: { include: { votes: true } } } },
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profile: { select: { presence: true, shareReadReceipts: true, shareTyping: true } },
            },
          },
        },
      },
    },
  });
  if (!conversation) {
    return null;
  }
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: id, userId } },
    data: { lastReadAt: now },
  });
  return { ...conversation, viewerId: userId, muted: membership.muted };
}

export async function sendMessageAction(formData: FormData) {
  await deliverMessage(formData);
}

export async function sendMessageResultAction(formData: FormData) {
  return deliverMessage(formData);
}

async function deliverMessage(formData: FormData) {
  const viewer = await requireUser();
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "");
  const file = formData.get("file");
  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      attachmentPath = await saveUpload(viewer.userId, new Uint8Array(await file.arrayBuffer()));
      attachmentName = file.name.slice(0, 120);
    } catch {
      return { ok: false as const, reason: "That file could not be stored. Use an image, a PDF, or a voice note under 2 MB." };
    }
  }
  const requested = new Date(String(formData.get("visibleAt") ?? ""));
  const visibleAt = !Number.isNaN(requested.getTime()) && requested.getTime() > Date.now() + 30_000 ? requested : new Date();
  const scheduled = visibleAt.getTime() > Date.now();
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: viewer.userId } },
  });
  if (!membership || (!body && !attachmentPath) || body.length > 2000) {
    return { ok: false as const, reason: body.length > 2000 ? "Keep a message under 2000 characters." : "That message could not be sent." };
  }
  if (parentId) {
    const parent = await prisma.message.findUnique({ where: { id: parentId }, select: { conversationId: true } });
    if (!parent || parent.conversationId !== conversationId) {
      return { ok: false as const, reason: "That reply could not be attached." };
    }
  }
  const members = await prisma.conversationMember.findMany({ where: { conversationId } });
  for (const member of members) {
    if (member.userId !== viewer.userId && (await blockedBetween(viewer.userId, member.userId))) {
      return { ok: false as const, reason: "A block stops this message." };
    }
  }
  await prisma.message.create({
    data: {
      conversationId,
      senderId: viewer.userId,
      body: body || (attachmentName ? attachmentName : ""),
      parentId: parentId || null,
      visibleAt,
      notified: !scheduled,
      kind: attachmentPath ? "file" : "text",
      attachmentPath,
      attachmentName,
    },
  });
  if (!scheduled) {
    for (const member of members) {
      if (member.userId !== viewer.userId && !member.muted) {
        await notifyUser({
          userId: member.userId,
          kind: "MESSAGE",
          title: "New message",
          body: `${viewer.name} sent a message.`,
          href: `/workspace/messages/${conversationId}`,
          preference: "notifyMessages",
        });
      }
    }
  }
  refresh([`/workspace/messages/${conversationId}`, "/workspace/messages", `/workspace/connect/chat/${conversationId}`, "/workspace/connect"]);
  return { ok: true as const };
}

export async function editMessageAction(formData: FormData) {
  const { userId } = await requireUser();
  const messageId = String(formData.get("messageId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.senderId !== userId || !body) {
    return;
  }
  const age = Date.now() - message.createdAt.getTime();
  if (age > 15 * 60 * 1000) {
    return;
  }
  await prisma.message.update({ where: { id: messageId }, data: { body, editedAt: new Date() } });
  refresh([`/workspace/messages/${message.conversationId}`]);
}

export async function deleteMessageAction(formData: FormData) {
  const { userId } = await requireUser();
  const message = await prisma.message.findUnique({ where: { id: String(formData.get("messageId") ?? "") } });
  if (!message || message.senderId !== userId || message.deletedAt) {
    return;
  }
  if (Date.now() - message.createdAt.getTime() > UNSEND_MS) {
    return;
  }
  await prisma.message.update({ where: { id: message.id }, data: { deletedAt: new Date(), body: "" } });
  refresh([`/workspace/messages/${message.conversationId}`]);
}

export async function pinMessageAction(formData: FormData) {
  const { userId } = await requireUser();
  const message = await prisma.message.findUnique({ where: { id: String(formData.get("messageId") ?? "") } });
  if (!message || message.deletedAt) {
    return;
  }
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: message.conversationId, userId } },
  });
  if (!membership) {
    return;
  }
  await prisma.message.update({
    where: { id: message.id },
    data: { pinnedAt: message.pinnedAt ? null : new Date() },
  });
  refresh([`/workspace/messages/${message.conversationId}`]);
}

export async function createPollAction(formData: FormData) {
  const viewer = await requireUser();
  const conversationId = String(formData.get("conversationId") ?? "");
  const question = String(formData.get("question") ?? "").trim();
  const labels = ["option1", "option2", "option3"]
    .map((name) => String(formData.get(name) ?? "").trim())
    .filter((label) => label.length > 0)
    .slice(0, 3);
  if (question.length < 2 || labels.length < 2) {
    return;
  }
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: viewer.userId } },
  });
  if (!membership) {
    return;
  }
  const message = await prisma.message.create({
    data: { conversationId, senderId: viewer.userId, body: question.slice(0, 200), kind: "poll" },
  });
  await prisma.messagePoll.create({
    data: {
      messageId: message.id,
      options: { create: labels.map((label) => ({ label: label.slice(0, 80) })) },
    },
  });
  refresh([`/workspace/messages/${conversationId}`]);
}

export async function votePollAction(formData: FormData) {
  const { userId } = await requireUser();
  const optionId = String(formData.get("optionId") ?? "");
  const option = await prisma.messagePollOption.findUnique({
    where: { id: optionId },
    include: { poll: { include: { message: true, options: true } } },
  });
  if (!option) {
    return;
  }
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: option.poll.message.conversationId, userId } },
  });
  if (!membership) {
    return;
  }
  const optionIds = option.poll.options.map((item) => item.id);
  await prisma.messagePollVote.deleteMany({ where: { userId, optionId: { in: optionIds } } });
  await prisma.messagePollVote.create({ data: { optionId, userId } });
  refresh([`/workspace/messages/${option.poll.message.conversationId}`]);
}

export async function sendVoiceNoteAction(formData: FormData) {
  const viewer = await requireUser();
  const conversationId = String(formData.get("conversationId") ?? "");
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || audio.size > 2 * 1024 * 1024) {
    return;
  }
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: viewer.userId } },
  });
  if (!membership) {
    return;
  }
  let attachmentPath: string;
  try {
    attachmentPath = await saveUpload(viewer.userId, new Uint8Array(await audio.arrayBuffer()));
  } catch {
    return;
  }
  await prisma.message.create({
    data: {
      conversationId,
      senderId: viewer.userId,
      body: "Voice note",
      kind: "voice",
      attachmentPath,
      attachmentName: "Voice note",
    },
  });
  refresh([`/workspace/messages/${conversationId}`]);
}

export async function reactMessageAction(formData: FormData) {
  const { userId } = await requireUser();
  const messageId = String(formData.get("messageId") ?? "");
  const emoji = String(formData.get("emoji") ?? "").slice(0, 8);
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || !emoji) {
    return;
  }
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: message.conversationId, userId } },
  });
  if (!membership) {
    return;
  }
  await prisma.messageReaction.upsert({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
    update: {},
    create: { messageId, userId, emoji },
  });
  refresh([`/workspace/messages/${message.conversationId}`]);
}

export async function muteConversationAction(formData: FormData) {
  const { userId } = await requireUser();
  const conversationId = String(formData.get("conversationId") ?? "");
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership) {
    return;
  }
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { muted: !membership.muted },
  });
  refresh([`/workspace/messages/${conversationId}`]);
}

export async function leaveGroupAction(formData: FormData) {
  const { userId } = await requireUser();
  const conversationId = String(formData.get("conversationId") ?? "");
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.kind !== "GROUP") {
    return;
  }
  await prisma.conversationMember.deleteMany({ where: { conversationId, userId } });
  redirect("/workspace/messages");
}

async function canSeePost(userId: string, post: { authorId: string; audience: "CONNECTIONS" | "COMMUNITY" | "COURSE" | "UNIVERSITY"; communityId: string | null; courseId: string | null }) {
  if (post.authorId === userId) {
    return true;
  }
  if (await blockedBetween(userId, post.authorId)) {
    return false;
  }
  const [isFriend, inCommunity, enrollment, staff, institution] = await Promise.all([
    areFriends(userId, post.authorId),
    post.communityId
      ? prisma.communityMember.findUnique({
          where: { communityId_userId: { communityId: post.communityId, userId } },
        })
      : Promise.resolve(null),
    post.courseId
      ? prisma.enrollment.findUnique({ where: { courseId_userId: { courseId: post.courseId, userId } } })
      : Promise.resolve(null),
    post.courseId
      ? prisma.courseStaff.findUnique({ where: { courseId_userId: { courseId: post.courseId, userId } } })
      : Promise.resolve(null),
    sameInstitution(userId, post.authorId),
  ]);
  return viewerCanSeeContent({
    isAuthor: false,
    blocked: false,
    audience: post.audience,
    isFriend,
    inCommunity: Boolean(inCommunity && !inCommunity.pending),
    inCourse: Boolean(enrollment) || Boolean(staff),
    sameInstitution: institution,
  });
}

export async function listFeed() {
  const { userId } = await requireUser();
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      author: { select: { id: true, name: true } },
      comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      reactions: true,
      community: { select: { name: true } },
    },
  });
  const visible = [];
  for (const post of posts) {
    if (await canSeePost(userId, post)) {
      visible.push({
        ...post,
        mine: post.author.id === userId,
        viewerReacted: post.reactions.some((reaction) => reaction.userId === userId),
      });
    }
  }
  return visible;
}

export async function createPostAction(formData: FormData) {
  const { userId } = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "CONNECTIONS");
  if (!body || body.length > 2000) {
    return;
  }
  if (!["CONNECTIONS", "COMMUNITY", "COURSE", "UNIVERSITY"].includes(audience)) {
    return;
  }
  const communityId = String(formData.get("communityId") ?? "") || null;
  const courseId = String(formData.get("courseId") ?? "") || null;
  if (audience === "COMMUNITY") {
    if (!communityId) {
      return;
    }
    const member = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!member || member.pending) {
      return;
    }
  }
  if (audience === "COURSE") {
    if (!courseId) {
      return;
    }
    const [enrollment, staff] = await Promise.all([
      prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId } } }),
      prisma.courseStaff.findUnique({ where: { courseId_userId: { courseId, userId } } }),
    ]);
    if (!enrollment && !staff) {
      return;
    }
  }
  let imagePath: string | undefined;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      imagePath = await saveUpload(userId, new Uint8Array(await file.arrayBuffer()), true);
    } catch {
      return;
    }
  }
  await prisma.post.create({
    data: {
      authorId: userId,
      body,
      audience: audience as "CONNECTIONS" | "COMMUNITY" | "COURSE" | "UNIVERSITY",
      communityId,
      courseId,
      imagePath,
    },
  });
  refresh(["/workspace/feed"]);
}

export async function commentAction(formData: FormData) {
  const { userId } = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || !body || !(await canSeePost(userId, post))) {
    return;
  }
  await prisma.comment.create({
    data: {
      postId,
      authorId: userId,
      body: body.slice(0, 1000),
      parentId: String(formData.get("parentId") ?? "") || null,
    },
  });
  refresh(["/workspace/feed", post.communityId ? `/workspace/communities/${post.communityId}` : "/workspace/feed"]);
}

export async function reactPostAction(formData: FormData) {
  const { userId } = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || !(await canSeePost(userId, post))) {
    return;
  }
  const existing = await prisma.postReaction.findUnique({ where: { postId_userId: { postId, userId } } });
  if (existing) {
    await prisma.postReaction.delete({ where: { postId_userId: { postId, userId } } });
  } else {
    await prisma.postReaction.create({ data: { postId, userId, emoji: "👏" } });
  }
  refresh(["/workspace/feed"]);
}

export async function deletePostAction(formData: FormData) {
  const { userId } = await requireUser();
  await prisma.post.deleteMany({ where: { id: String(formData.get("postId") ?? ""), authorId: userId } });
  refresh(["/workspace/feed"]);
}

export async function createStoryAction(formData: FormData) {
  const { userId } = await requireUser();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }
  let imagePath: string;
  try {
    imagePath = await saveUpload(userId, new Uint8Array(await file.arrayBuffer()), true);
  } catch {
    return;
  }
  const requested = formData.getAll("circle").map((value) => String(value)).filter(Boolean);
  const circle: string[] = [];
  for (const friendId of requested) {
    if (friendId !== userId && (await areFriends(userId, friendId)) && !(await blockedBetween(userId, friendId))) {
      circle.push(friendId);
    }
  }
  await prisma.story.create({
    data: {
      authorId: userId,
      imagePath,
      caption: String(formData.get("caption") ?? "").slice(0, 140),
      audience: "CONNECTIONS",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      circle: circle.length ? { create: circle.map((friendId) => ({ userId: friendId })) } : undefined,
    },
  });
  refresh(["/workspace/stories"]);
}

export async function listCircleFriends() {
  const { userId } = await requireUser();
  const ids = await friendIds(userId);
  if (ids.length === 0) {
    return [];
  }
  return prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listStories() {
  const { userId } = await requireUser();
  const stories = await prisma.story.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true } }, circle: { select: { userId: true } } },
  });
  const mutes = await prisma.storyMute.findMany({ where: { userId } });
  const muted = new Set(mutes.map((item) => item.authorId));
  const visible = [];
  for (const story of stories) {
    if (muted.has(story.authorId) && story.authorId !== userId) {
      continue;
    }
    const allowed = await viewerCanSeeContent({
      isAuthor: story.authorId === userId,
      blocked: story.authorId !== userId && (await blockedBetween(userId, story.authorId)),
      audience: story.audience,
      isFriend: story.authorId === userId || (await areFriends(userId, story.authorId)),
      inCommunity: false,
      inCourse: false,
      sameInstitution: await sameInstitution(userId, story.authorId),
      expired: story.expiresAt <= new Date(),
    });
    if (!allowed) {
      continue;
    }
    if (story.circle.length > 0 && story.authorId !== userId && !story.circle.some((row) => row.userId === userId)) {
      continue;
    }
    visible.push(story);
  }
  return visible;
}

export async function saveCommunityHighlightAction(formData: FormData) {
  const { userId } = await requireUser();
  const communityId = String(formData.get("communityId") ?? "");
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  });
  if (!membership || membership.pending || membership.role !== "MODERATOR") {
    const community = await prisma.community.findUnique({ where: { id: communityId }, select: { createdById: true } });
    if (!community || community.createdById !== userId) {
      return;
    }
  }
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }
  let imagePath: string;
  try {
    imagePath = await saveUpload(userId, new Uint8Array(await file.arrayBuffer()), true);
  } catch {
    return;
  }
  await prisma.communityHighlight.upsert({
    where: { communityId },
    update: { imagePath, caption: String(formData.get("caption") ?? "").slice(0, 140), savedById: userId },
    create: {
      communityId,
      imagePath,
      caption: String(formData.get("caption") ?? "").slice(0, 140),
      savedById: userId,
    },
  });
  refresh([`/workspace/communities/${communityId}`]);
}

export async function deleteStoryAction(formData: FormData) {
  const { userId } = await requireUser();
  await prisma.story.deleteMany({ where: { id: String(formData.get("storyId") ?? ""), authorId: userId } });
  refresh(["/workspace/stories"]);
}

export async function muteStoriesAction(formData: FormData) {
  const { userId } = await requireUser();
  const authorId = String(formData.get("authorId") ?? "");
  await prisma.storyMute.upsert({
    where: { userId_authorId: { userId, authorId } },
    update: {},
    create: { userId, authorId },
  });
  refresh(["/workspace/stories"]);
}

export async function listCommunities() {
  const { userId } = await requireUser();
  const communities = await prisma.community.findMany({
    orderBy: { name: "asc" },
    include: { members: true, course: { select: { title: true } } },
  });
  return communities
    .filter((community) => community.visibility === "PUBLIC" || community.members.some((member) => member.userId === userId))
    .map((community) => ({
      ...community,
      mine: community.members.find((member) => member.userId === userId) ?? null,
    }));
}

export async function createCommunityAction(formData: FormData) {
  const { userId } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) {
    return;
  }
  const community = await prisma.community.create({
    data: {
      name,
      description: String(formData.get("description") ?? "").slice(0, 500),
      visibility: formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC",
      createdById: userId,
      courseId: String(formData.get("courseId") ?? "") || null,
      members: { create: { userId, role: "MODERATOR", pending: false } },
    },
  });
  redirect(`/workspace/communities/${community.id}`);
}

export async function joinCommunityAction(formData: FormData) {
  const { userId } = await requireUser();
  const communityId = String(formData.get("communityId") ?? "");
  const community = await prisma.community.findUnique({ where: { id: communityId } });
  if (!community) {
    return;
  }
  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId, userId } },
    update: {},
    create: { communityId, userId, pending: community.visibility === "PRIVATE" },
  });
  refresh([`/workspace/communities/${communityId}`, "/workspace/communities"]);
}

export async function decideMemberAction(formData: FormData) {
  const { userId } = await requireUser();
  const communityId = String(formData.get("communityId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const moderator = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  });
  if (!moderator || moderator.role !== "MODERATOR") {
    return;
  }
  if (formData.get("decision") === "approve") {
    await prisma.communityMember.update({
      where: { communityId_userId: { communityId, userId: memberId } },
      data: { pending: false },
    });
  } else {
    await prisma.communityMember.delete({
      where: { communityId_userId: { communityId, userId: memberId } },
    });
  }
  refresh([`/workspace/communities/${communityId}`]);
}

export async function leaveCommunityAction(formData: FormData) {
  const { userId } = await requireUser();
  const communityId = String(formData.get("communityId") ?? "");
  await prisma.communityMember.deleteMany({ where: { communityId, userId } });
  refresh(["/workspace/communities"]);
}

export async function listQuietHome() {
  const viewer = await requireUser();
  const profile = await prisma.quietProfile.findUnique({ where: { userId: viewer.userId } });
  const introductions = await prisma.quietIntroduction.findMany({
    where: {
      OR: [{ userAId: viewer.userId }, { userBId: viewer.userId }],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      userA: { select: { name: true } },
      userB: { select: { name: true } },
    },
  });
  return {
    adult: viewer.band === "adult",
    optedIn: Boolean(profile?.optedIn),
    starters: profile?.starters ?? "",
    introductions: introductions.map((intro) => {
      const viewerIsA = intro.userAId === viewer.userId;
      return {
        id: intro.id,
        status: intro.status,
        label: quietLabel({
          status: intro.status,
          viewerIsA,
          aliasA: intro.aliasA,
          aliasB: intro.aliasB,
          nameA: intro.userA.name,
          nameB: intro.userB.name,
        }),
      };
    }),
  };
}

export async function loadCommunity(id: string) {
  const { userId } = await requireUser();
  const community = await prisma.community.findUnique({
    where: { id },
    include: {
      highlight: true,
      members: { include: { user: { select: { id: true, name: true } } } },
      posts: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { name: true } },
          comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
        },
      },
    },
  });
  if (!community) {
    return null;
  }
  const mine = community.members.find((member) => member.userId === userId) ?? null;
  if (community.visibility === "PRIVATE" && (!mine || mine.pending)) {
    return { community: { ...community, posts: [] }, mine, restricted: true };
  }
  return { community, mine, restricted: false };
}
