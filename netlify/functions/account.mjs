import {getStore} from '@netlify/blobs';
import {createAccountHandler} from '../../web/auth.mjs';
export default createAccountHandler(name=>getStore({name,consistency:'strong'}));
export const config={path:'/api/account'};
