import Pusher from "pusher";

const appId = process.env.PUSHER_APP_ID;
const key = process.env.PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.PUSHER_CLUSTER;

export const isPusherConfigured = Boolean(appId && key && secret && cluster);

export const pusher = isPusherConfigured
  ? new Pusher({
      appId: appId!,
      key: key!,
      secret: secret!,
      cluster: cluster!,
      useTLS: true,
    })
  : null;

export const classroomChannel = (classroomId: string) =>
  `classroom-${classroomId}`;
