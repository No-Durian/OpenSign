import { appName } from '../../Utils.js';
import { isRealActiveAdmin } from './adminBootstrapUtils.js';

// `GetLogoByDomain` is used to get logo by domain as well as check any tenant exist or not in db
export default async function GetLogoByDomain(request) {
  const domain = request.params.domain;
  try {
    const tenantCreditsQuery = new Parse.Query('partners_Tenant');
    tenantCreditsQuery.equalTo('Domain', domain);
    const res = await tenantCreditsQuery.first({ useMasterKey: true });
    if (res) {
      const updateRes = JSON.parse(JSON.stringify(res));
      return {
        logo: updateRes?.Logo,
        favicon: updateRes?.Favicon || updateRes?.Logo,
        appname: appName,
        user: 'exist',
      };
    }

    const adminQuery = new Parse.Query('contracts_Users');
    adminQuery.equalTo('UserRole', 'contracts_Admin');
    const admins = await adminQuery.find({ useMasterKey: true });
    const hasRealAdmin = (admins || []).some(isRealActiveAdmin);

    if (hasRealAdmin) {
      return { logo: '', appname: appName, user: 'exist' };
    }

    return { logo: '', appname: appName, user: 'not_exist' };
  } catch (err) {
    const code = err.code || 400;
    const msg = err.message || 'Something went wrong.';
    throw new Parse.Error(code, msg);
  }
}
