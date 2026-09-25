let accountCollabName: string | null = null;
let accountCollabAvatar: string | null = null;

export const setAccountCollabIdentity = (
  name: string | null,
  avatarUrl: string | null,
) => {
  accountCollabName = name;
  accountCollabAvatar = avatarUrl;
};

export const getAccountCollabName = () => accountCollabName;

export const getAccountCollabAvatar = () => accountCollabAvatar;
