import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { ChurchToolsClient } from "@churchtools/churchtools-client";
import { getEnvForDomain } from "@/lib/domainenv";
import { GroupMemberField, MemberField, Member } from "./types";

export function getChurchToolsClient(domain: string) {
  const token = getEnvForDomain("CT_TOKEN", decodeURIComponent(domain));
  if (!token) {
    return null;
  }

  const churchToolsClient = new ChurchToolsClient(
    `https://${domain}.church.tools`,
    token,
  );
  churchToolsClient.setCookieJar(wrapper, new CookieJar());
  return churchToolsClient;
}

export async function getMember(
  churchToolsClient: ChurchToolsClient,
  groupId: string,
  personId: string,
) {
  const members: Member[] = await churchToolsClient.getAllPages(
    `/groups/${groupId}/members`,
  );
  return members.find((member) => member.personId === +personId);
}

export function getPaidField(member: Member) {
  return member.fields.find((field) =>
    ["bezahlt", "paid"].includes(field.name.toLowerCase()),
  );
}

export function extractEuroAmount(input: string): number | null {
  const normalized = input.replace(",", ".");
  const match = /(\d+(?:\.\d+)?)\s?€/.exec(normalized);

  if (match && match[1]) {
    return parseFloat(match[1]);
  }

  const amount = parseFloat(normalized);
  if (!isNaN(amount)) {
    return amount;
  }

  return null;
}

export function getAmountField(member: Member) {
  return member.fields.find((field) =>
    ["betrag", "preis", "buchung", "auswahl"].includes(
      field.name.toLowerCase(),
    ),
  );
}

/**
 * Auswahlfelder liefern in /members nicht das Label, sondern die Options-ID
 * (z.B. "20169" für die Option "69"). Das Label steht nur in /memberfields.
 * Gibt null zurück, wenn eine Options-ID nicht aufgelöst werden kann – dann
 * lieber gar keinen Betrag als einen falschen.
 */
export function resolveMemberFieldValues(
  memberField: MemberField,
  groupMemberFields: GroupMemberField[],
): string[] | null {
  const options =
    groupMemberFields.find(
      (groupMemberField) =>
        groupMemberField.type === "group" &&
        groupMemberField.field?.id === memberField.id,
    )?.field?.options ?? [];

  const value = memberField.value;
  if (value === null || value === undefined) {
    return [];
  }

  if (options.length === 0) {
    return Array.isArray(value) ? value : [value];
  }

  const optionIds = Array.isArray(value) ? value : String(value).split(",");
  const labels = optionIds
    .map((optionId) => String(optionId).trim())
    .filter((optionId) => optionId !== "")
    .map(
      (optionId) =>
        options.find((option) => String(option.id) === optionId)?.name,
    );

  if (labels.some((label) => label === undefined)) {
    return null;
  }
  return labels as string[];
}

export function sumEuroAmounts(values: string[]): number | null {
  const amounts = values.map(extractEuroAmount);
  if (amounts.length === 0 || amounts.some((amount) => amount === null)) {
    return null;
  }
  return amounts.reduce((sum: number, amount) => sum + amount!, 0);
}

export async function getGroupMemberFields(
  churchToolsClient: ChurchToolsClient,
  groupId: string,
) {
  const fields: GroupMemberField[] = await churchToolsClient.get(
    `/groups/${groupId}/memberfields`,
  );
  return fields;
}

export async function setPaid(
  churchToolsClient: ChurchToolsClient,
  groupId: string,
  personId: string,
) {
  const fields = await getGroupMemberFields(churchToolsClient, groupId);
  const paidField = fields.find(
    (field) =>
      field.field?.name?.toLowerCase()?.includes("bezahlt") ||
      field.field?.name?.toLowerCase()?.includes("paid"),
  );
  const paidFieldId = paidField?.field.id;
  if (!paidFieldId) {
    console.error("paidField not found");
    return;
  }
  await churchToolsClient.put(`/groups/${groupId}/members/${personId}`, {
    fields: { [paidFieldId]: "1" },
  });
}
