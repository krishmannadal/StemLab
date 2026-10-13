import {getStore} from '@netlify/blobs';
import {createChatHandler} from '../../web/chat-handler.mjs';
export default createChatHandler(name=>getStore({name,consistency:'strong'}));
export const config={path:'/api/chat'};
