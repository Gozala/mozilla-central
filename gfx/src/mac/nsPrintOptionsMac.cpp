/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: NPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Netscape Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/NPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is 
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the NPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the NPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include "nsPrintOptionsMac.h"
#include "nsPrintSettingsMac.h"

#define MAC_OS_PAGE_SETUP_PREFNAME  "print.macos.pagesetup"

/** ---------------------------------------------------
 *  See documentation in nsPrintOptionsMac.h
 *	@update 6/21/00 dwc
 */
nsPrintOptionsMac::nsPrintOptionsMac()
{
}

/** ---------------------------------------------------
 *  See documentation in nsPrintOptionsImpl.h
 *	@update 6/21/00 dwc
 */
nsPrintOptionsMac::~nsPrintOptionsMac()
{
}

/** ---------------------------------------------------
 *  See documentation in nsPrintOptionsImpl.h
 */
/* nsIPrintSettings CreatePrintSettings (); */
NS_IMETHODIMP nsPrintOptionsMac::CreatePrintSettings(nsIPrintSettings **_retval)
{
  nsresult rv;
  nsPrintSettingsMac* printSettings = new nsPrintSettingsMac(); // does not initially ref count
  if (!printSettings)
    return NS_ERROR_OUT_OF_MEMORY;
  rv = printSettings->Init();
  if (NS_FAILED(rv))
    return rv;
    
  return printSettings->QueryInterface(NS_GET_IID(nsIPrintSettings), (void**)_retval); // ref counts
}

/** ---------------------------------------------------
 *  See documentation in nsPrintOptionsImpl.h
 *	@update 6/21/00 dwc
 */
NS_IMETHODIMP
nsPrintOptionsMac::ShowPrintSetupDialog(nsIPrintSettings *aThePrintSettings)
{
    return NS_ERROR_NOT_IMPLEMENTED;
} 

/* [noscript] voidPtr GetNativeData (in short aDataType); */
NS_IMETHODIMP
nsPrintOptionsMac::GetNativeData(PRInt16 aDataType, void * *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = nsnull;
  
  return NS_ERROR_NOT_IMPLEMENTED;
}

#pragma mark -

nsresult
nsPrintOptionsMac::ReadPrefs(nsIPrintSettings* aPS, const nsString& aPrefName, PRUint32 aFlags)
{
  nsresult rv;
  
  rv = nsPrintOptions::ReadPrefs(aPS, aPrefName, aFlags);
  NS_ASSERTION(NS_SUCCEEDED(rv), "nsPrintOptions::ReadPrefs() failed");
  
  nsCOMPtr<nsIPrintSettingsMac> printSettingsMac(do_QueryInterface(aPS));
  if (!printSettingsMac)
    return NS_ERROR_NO_INTERFACE;
  rv = printSettingsMac->ReadPageSetupFromPrefs();
  NS_ASSERTION(NS_SUCCEEDED(rv), "nsIPrintSettingsMac::ReadPageFormatFromPrefs() failed");
  
  return NS_OK;
}

nsresult
nsPrintOptionsMac::WritePrefs(nsIPrintSettings* aPS, const nsString& aPrefName, PRUint32 aFlags)
{
  nsresult rv;
  
  rv = nsPrintOptions::WritePrefs(aPS, aPrefName, aFlags);
  NS_ASSERTION(NS_SUCCEEDED(rv), "nsPrintOptions::WritePrefs() failed");
  
  nsCOMPtr<nsIPrintSettingsMac> printSettingsMac(do_QueryInterface(aPS));
  if (!printSettingsMac)
    return NS_ERROR_NO_INTERFACE;
  rv = printSettingsMac->WritePageSetupToPrefs();
  NS_ASSERTION(NS_SUCCEEDED(rv), "nsIPrintSettingsX::WritePageFormatToPrefs() failed");
  
  return NS_OK;
}
