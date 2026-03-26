import { isRealActiveAdmin } from './adminBootstrapUtils.js';

// `CheckAdminExist` is used to check whether a real admin already exists
export default async function CheckAdminExist() {
  try {
    const extClsQuery = new Parse.Query('contracts_Users');
    extClsQuery.equalTo('UserRole', 'contracts_Admin');
    const extAdminRes = await extClsQuery.find({ useMasterKey: true });
    const activeAdmins = (extAdminRes || []).filter(isRealActiveAdmin);
    if (activeAdmins.length > 0) {
      return 'exist';
    }
    return 'not_exist';
  } catch (err) {
    console.log('err in isAdminExist', err);
    const code = err?.code || 400;
    const msg = err?.message || 'something went wrong.';
    throw new Parse.Error(code, msg);
  }
}
