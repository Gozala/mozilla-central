/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsNavBookmarks_h_
#define nsNavBookmarks_h_

#include "nsINavBookmarksService.h"
#include "nsIAnnotationService.h"
#include "nsITransaction.h"
#include "nsNavHistory.h"
#include "nsToolkitCompsCID.h"
#include "nsCategoryCache.h"
#include "nsTHashtable.h"
#include "nsWeakReference.h"
#include "mozilla/Attributes.h"
#include "prtime.h"

class nsNavBookmarks;
class nsIOutputStream;

namespace mozilla {
namespace places {

  enum BookmarkStatementId {
    DB_FIND_REDIRECTED_BOOKMARK = 0
  , DB_GET_BOOKMARKS_FOR_URI
  };

  struct BookmarkData {
    int64_t id;
    nsCString url;
    nsCString title;
    int32_t position;
    int64_t placeId;
    int64_t parentId;
    int64_t grandParentId;
    int32_t type;
    nsCString serviceCID;
    PRTime dateAdded;
    PRTime lastModified;
    nsCString guid;
    nsCString parentGuid;
  };

  struct ItemVisitData {
    BookmarkData bookmark;
    int64_t visitId;
    uint32_t transitionType;
    PRTime time;
  };

  struct ItemChangeData {
    BookmarkData bookmark;
    nsCString property;
    bool isAnnotation;
    nsCString newValue;
  };

  typedef void (nsNavBookmarks::*ItemVisitMethod)(const ItemVisitData&);
  typedef void (nsNavBookmarks::*ItemChangeMethod)(const ItemChangeData&);

  class BookmarkKeyClass : public nsTrimInt64HashKey
  {
    public:
    BookmarkKeyClass(const int64_t* aItemId)
    : nsTrimInt64HashKey(aItemId)
    , creationTime(PR_Now())
    {
    }
    BookmarkKeyClass(const BookmarkKeyClass& aOther)
    : nsTrimInt64HashKey(aOther)
    , creationTime(PR_Now())
    {
      NS_NOTREACHED("Do not call me!");
    }
    BookmarkData bookmark;
    PRTime creationTime;
  };

  enum BookmarkDate {
    DATE_ADDED = 0
  , LAST_MODIFIED
  };

} // namespace places
} // namespace mozilla

class nsNavBookmarks MOZ_FINAL : public nsINavBookmarksService
                               , public nsINavHistoryObserver
                               , public nsIAnnotationObserver
                               , public nsIObserver
                               , public nsSupportsWeakReference
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSINAVBOOKMARKSSERVICE
  NS_DECL_NSINAVHISTORYOBSERVER
  NS_DECL_NSIANNOTATIONOBSERVER
  NS_DECL_NSIOBSERVER

  nsNavBookmarks();

  /**
   * Obtains the service's object.
   */
  static already_AddRefed<nsNavBookmarks> GetSingleton();

  /**
   * Initializes the service's object.  This should only be called once.
   */
  nsresult Init();

  static nsNavBookmarks* GetBookmarksService() {
    if (!gBookmarksService) {
      nsCOMPtr<nsINavBookmarksService> serv =
        do_GetService(NS_NAVBOOKMARKSSERVICE_CONTRACTID);
      NS_ENSURE_TRUE(serv, nullptr);
      NS_ASSERTION(gBookmarksService,
                   "Should have static instance pointer now");
    }
    return gBookmarksService;
  }

  typedef mozilla::places::BookmarkData BookmarkData;
  typedef mozilla::places::BookmarkKeyClass BookmarkKeyClass;
  typedef mozilla::places::ItemVisitData ItemVisitData;
  typedef mozilla::places::ItemChangeData ItemChangeData;
  typedef mozilla::places::BookmarkStatementId BookmarkStatementId;

  nsresult ResultNodeForContainer(int64_t aID,
                                  nsNavHistoryQueryOptions* aOptions,
                                  nsNavHistoryResultNode** aNode);

  // Find all the children of a folder, using the given query and options.
  // For each child, a ResultNode is created and added to |children|.
  // The results are ordered by folder position.
  nsresult QueryFolderChildren(int64_t aFolderId,
                               nsNavHistoryQueryOptions* aOptions,
                               nsCOMArray<nsNavHistoryResultNode>* children);

  /**
   * Turns aRow into a node and appends it to aChildren if it is appropriate to
   * do so.
   *
   * @param aRow
   *        A Storage statement (in the case of synchronous execution) or row of
   *        a result set (in the case of asynchronous execution).
   * @param aOptions
   *        The options of the parent folder node.
   * @param aChildren
   *        The children of the parent folder node.
   * @param aCurrentIndex
   *        The index of aRow within the results.  When called on the first row,
   *        this should be set to -1.
   */
  nsresult ProcessFolderNodeRow(mozIStorageValueArray* aRow,
                                nsNavHistoryQueryOptions* aOptions,
                                nsCOMArray<nsNavHistoryResultNode>* aChildren,
                                int32_t& aCurrentIndex);

  /**
   * The async version of QueryFolderChildren.
   *
   * @param aNode
   *        The folder node that will receive the children.
   * @param _pendingStmt
   *        The Storage pending statement that will be used to control async
   *        execution.
   */
  nsresult QueryFolderChildrenAsync(nsNavHistoryFolderResultNode* aNode,
                                    int64_t aFolderId,
                                    mozIStoragePendingStatement** _pendingStmt);

  /**
   * @return index of the new folder in aIndex, whether it was passed in or
   *         generated by autoincrement.
   *
   * @note If aFolder is -1, uses the autoincrement id for folder index.
   * @note aTitle will be truncated to TITLE_LENGTH_MAX
   */
  nsresult CreateContainerWithID(int64_t aId, int64_t aParent,
                                 const nsACString& aTitle,
                                 bool aIsBookmarkFolder,
                                 int32_t* aIndex,
                                 int64_t* aNewFolder);

  /**
   * Fetches information about the specified id from the database.
   *
   * @param aItemId
   *        Id of the item to fetch information for.
   * @param aBookmark
   *        BookmarkData to store the information.
   */
  nsresult FetchItemInfo(int64_t aItemId,
                         BookmarkData& _bookmark);

  /**
   * Notifies that a bookmark has been visited.
   *
   * @param aItemId
   *        The visited item id.
   * @param aData
   *        Details about the new visit.
   */
  void NotifyItemVisited(const ItemVisitData& aData);

  /**
   * Notifies that a bookmark has changed.
   *
   * @param aItemId
   *        The changed item id.
   * @param aData
   *        Details about the change.
   */
  void NotifyItemChanged(const ItemChangeData& aData);

  /**
   * Recursively builds an array of descendant folders inside a given folder.
   *
   * @param aFolderId
   *        The folder to fetch descendants from.
   * @param aDescendantFoldersArray
   *        Output array to put descendant folders id.
   */
  nsresult GetDescendantFolders(int64_t aFolderId,
                                nsTArray<int64_t>& aDescendantFoldersArray);

private:
  static nsNavBookmarks* gBookmarksService;

  ~nsNavBookmarks();

  /**
   * Locates the root items in the bookmarks folder hierarchy assigning folder
   * ids to the root properties that are exposed through the service interface.
   */
  nsresult ReadRoots();

  nsresult AdjustIndices(int64_t aFolder,
                         int32_t aStartIndex,
                         int32_t aEndIndex,
                         int32_t aDelta);

  /**
   * Fetches properties of a folder.
   *
   * @param aFolderId
   *        Folder to count children for.
   * @param _folderCount
   *        Number of children in the folder.
   * @param _guid
   *        Unique id of the folder.
   * @param _parentId
   *        Id of the parent of the folder.
   *
   * @throws If folder does not exist.
   */
  nsresult FetchFolderInfo(int64_t aFolderId,
                           int32_t* _folderCount,
                           nsACString& _guid,
                           int64_t* _parentId);

  nsresult GetLastChildId(int64_t aFolder, int64_t* aItemId);

  /**
   * This is an handle to the Places database.
   */
  nsRefPtr<mozilla::places::Database> mDB;

  int32_t mItemCount;

  nsMaybeWeakPtrArray<nsINavBookmarkObserver> mObservers;

  int64_t mRoot;
  int64_t mMenuRoot;
  int64_t mTagsRoot;
  int64_t mUnfiledRoot;
  int64_t mToolbarRoot;

  inline bool IsRoot(int64_t aFolderId) {
    return aFolderId == mRoot || aFolderId == mMenuRoot ||
           aFolderId == mTagsRoot || aFolderId == mUnfiledRoot ||
           aFolderId == mToolbarRoot;
  }

  nsresult IsBookmarkedInDatabase(int64_t aBookmarkID, bool* aIsBookmarked);

  nsresult SetItemDateInternal(enum mozilla::places::BookmarkDate aDateType,
                               int64_t aItemId,
                               PRTime aValue);

  // Recursive method to build an array of folder's children
  nsresult GetDescendantChildren(int64_t aFolderId,
                                 const nsACString& aFolderGuid,
                                 int64_t aGrandParentId,
                                 nsTArray<BookmarkData>& aFolderChildrenArray);

  enum ItemType {
    BOOKMARK = TYPE_BOOKMARK,
    FOLDER = TYPE_FOLDER,
    SEPARATOR = TYPE_SEPARATOR,
  };

  /**
   * Helper to insert a bookmark in the database.
   *
   *  @param aItemId
   *         The itemId to insert, pass -1 to generate a new one.
   *  @param aPlaceId
   *         The placeId to which this bookmark refers to, pass nullptr for
   *         items that don't refer to an URI (eg. folders, separators, ...).
   *  @param aItemType
   *         The type of the new bookmark, see TYPE_* constants.
   *  @param aParentId
   *         The itemId of the parent folder.
   *  @param aIndex
   *         The position inside the parent folder.
   *  @param aTitle
   *         The title for the new bookmark.
   *         Pass a void string to set a NULL title.
   *  @param aDateAdded
   *         The date for the insertion.
   *  @param [optional] aLastModified
   *         The last modified date for the insertion.
   *         It defaults to aDateAdded.
   *
   *  @return The new item id that has been inserted.
   *
   *  @note This will also update last modified date of the parent folder.
   */
  nsresult InsertBookmarkInDB(int64_t aPlaceId,
                              enum ItemType aItemType,
                              int64_t aParentId,
                              int32_t aIndex,
                              const nsACString& aTitle,
                              PRTime aDateAdded,
                              PRTime aLastModified,
                              const nsACString& aParentGuid,
                              int64_t aGrandParentId,
                              nsIURI* aURI,
                              int64_t* _itemId,
                              nsACString& _guid);

  /**
   * TArray version of getBookmarksIdForURI for ease of use in C++ code.
   * Pass in a reference to a TArray; it will get filled with the
   * resulting list of bookmark IDs.
   *
   * @param aURI
   *        URI to get bookmarks for.
   * @param aResult
   *        Array of bookmark ids.
   * @param aSkipTags
   *        If true ids of tags-as-bookmarks entries will be excluded.
   */
  nsresult GetBookmarkIdsForURITArray(nsIURI* aURI,
                                      nsTArray<int64_t>& aResult,
                                      bool aSkipTags);

  nsresult GetBookmarksForURI(nsIURI* aURI,
                              nsTArray<BookmarkData>& _bookmarks);

  int64_t RecursiveFindRedirectedBookmark(int64_t aPlaceId);

  static const int32_t kGetChildrenIndex_Position;
  static const int32_t kGetChildrenIndex_Type;
  static const int32_t kGetChildrenIndex_PlaceID;
  static const int32_t kGetChildrenIndex_FolderTitle;
  static const int32_t kGetChildrenIndex_Guid;

  class RemoveFolderTransaction MOZ_FINAL : public nsITransaction {
  public:
    RemoveFolderTransaction(int64_t aID) : mID(aID) {}

    NS_DECL_ISUPPORTS

    NS_IMETHOD DoTransaction() {
      nsNavBookmarks* bookmarks = nsNavBookmarks::GetBookmarksService();
      NS_ENSURE_TRUE(bookmarks, NS_ERROR_OUT_OF_MEMORY);
      BookmarkData folder;
      nsresult rv = bookmarks->FetchItemInfo(mID, folder);
      // TODO (Bug 656935): store the BookmarkData struct instead.
      mParent = folder.parentId;
      mIndex = folder.position;

      rv = bookmarks->GetItemTitle(mID, mTitle);
      NS_ENSURE_SUCCESS(rv, rv);

      return bookmarks->RemoveItem(mID);
    }

    NS_IMETHOD UndoTransaction() {
      nsNavBookmarks* bookmarks = nsNavBookmarks::GetBookmarksService();
      NS_ENSURE_TRUE(bookmarks, NS_ERROR_OUT_OF_MEMORY);
      int64_t newFolder;
      return bookmarks->CreateContainerWithID(mID, mParent, mTitle, true,
                                              &mIndex, &newFolder); 
    }

    NS_IMETHOD RedoTransaction() {
      return DoTransaction();
    }

    NS_IMETHOD GetIsTransient(bool* aResult) {
      *aResult = false;
      return NS_OK;
    }
    
    NS_IMETHOD Merge(nsITransaction* aTransaction, bool* aResult) {
      *aResult = false;
      return NS_OK;
    }

  private:
    int64_t mID;
    int64_t mParent;
    nsCString mTitle;
    int32_t mIndex;
  };

  // Used to enable and disable the observer notifications.
  bool mCanNotify;
  nsCategoryCache<nsINavBookmarkObserver> mCacheObservers;

  // Tracks whether we are in batch mode.
  // Note: this is only tracking bookmarks batches, not history ones.
  bool mBatching;

  /**
   * Always call EnsureKeywordsHash() and check it for errors before actually
   * using the hash.  Internal keyword methods are already doing that.
   */
  nsresult EnsureKeywordsHash();
  nsDataHashtable<nsTrimInt64HashKey, nsString> mBookmarkToKeywordHash;

  /**
   * This function must be called every time a bookmark is removed.
   *
   * @param aURI
   *        Uri to test.
   */
  nsresult UpdateKeywordsHashForRemovedBookmark(int64_t aItemId);

  /**
   * Cache for the last fetched BookmarkData entries.
   * This is used to speed up repeated requests to the same item id.
   */
  nsTHashtable<BookmarkKeyClass> mRecentBookmarksCache;

  /**
   * Tracks bookmarks in the cache critical path.  Items should not be
   * added to the cache till they are removed from this hash.
   */
  nsTHashtable<nsTrimInt64HashKey> mUncachableBookmarks;
};

#endif // nsNavBookmarks_h_
