import {FileItem, FileItemEventResponse, UploadOptions} from './file-item.class';
import {Subscription} from 'rxjs/Subscription';
import {Subject} from 'rxjs/Subject';
import {Observable} from 'rxjs/Observable';

export interface QueueOptions {
    queueLimit?: number;
    removeAfterUpload?: boolean;
    parallel?: boolean;
    retryFailedItem?: boolean;
}

type UploadingItem = {
    item: FileItem;
    subscriptions: Array<Subscription>;
    markedToUpload?: boolean;
};


export class QueueController {
    private queueOptions: QueueOptions;
    private uploadingQueue: UploadingItem[];
    public queueProgress = 0;
    public isUploading = false;

    private itemUploaded = new Subject<FileItemEventResponse>();
    private itemError = new Subject<FileItemEventResponse>();
    private itemPause = new Subject<FileItemEventResponse>();
    private itemProgress = new Subject<FileItemEventResponse>();
    private itemCancel = new Subject<FileItemEventResponse>();

    constructor(options: QueueOptions) {
        this.queueOptions = options;
        this.uploadingQueue = [];
    }

    public onItemUploaded(): Observable<FileItemEventResponse> {
        return this.itemUploaded.asObservable();
    }

    public onItemError(): Observable<FileItemEventResponse> {
        return this.itemError.asObservable();
    }

    public onItemPause(): Observable<FileItemEventResponse> {
        return this.itemPause.asObservable();
    }

    public onItemProgress(): Observable<FileItemEventResponse> {
        return this.itemProgress.asObservable();
    }

    public onItemCancel(): Observable<FileItemEventResponse> {
        return this.itemCancel.asObservable();
    }

    public getNotUploadedItems(): any[] {
        return this.uploadingQueue.filter((item: UploadingItem) => !item.item.isUploaded);
    }

    public getQueueLenght() {
        return this.uploadingQueue.length;
    }

    public addFilesToQueue(files: File[], options: UploadOptions, validate?: boolean): FileItem[] {
        const addedFiles = [];
        files.forEach(file => {
            const fileItem = new FileItem(file, options);
            if (validate) {
                fileItem.validateFile();
            }
            addedFiles.push(fileItem);
            const uploadingItem = {item: fileItem, subscriptions: []};
            this.uploadingQueue.push(uploadingItem);
            uploadingItem.subscriptions.push(uploadingItem.item.onProgress().subscribe((response: FileItemEventResponse) => {
                this.itemProgress.next(response);
                this.calculateProgress();
                this.isFilesUploading();
            }));
            uploadingItem.subscriptions.push(uploadingItem.item.onCancel().subscribe((response: FileItemEventResponse) => {
                this.itemCancel.next(response);
                this.calculateProgress();
                this.isFilesUploading();
            }));
            uploadingItem.subscriptions.push(uploadingItem.item.onError().subscribe((response: FileItemEventResponse) => {
                this.itemError.next(response);
                this.calculateProgress();
                this.isFilesUploading();
            }));
            uploadingItem.subscriptions.push(uploadingItem.item.onPause().subscribe((response: FileItemEventResponse) => {
                this.itemPause.next(response);
                this.calculateProgress();
                this.isFilesUploading();
            }));
            uploadingItem.subscriptions.push(uploadingItem.item.onSuccess().subscribe((response: FileItemEventResponse) => {
                this.itemUploaded.next(response);
                this.calculateProgress();
                const next = this.getNextToUpload();
                if (next && next.markedToUpload) {
                   this.uploadItem(next);
                }
                if (this.queueOptions.removeAfterUpload) {
                   this.removeFromQueue(uploadingItem.item);
                }
            }));
        });
        return addedFiles;
    }

    public addFileItemsToQueue(files: FileItem[], validate?: boolean): FileItem[] {
        files.forEach(file => {
            if (validate) {
                file.validateFile();
            }
            this.uploadingQueue.push({item: file, subscriptions: []});
        });
        return files;
    }

    public removeFromQueue(file: FileItem) {
        let itemIndex = -1;
        let uploadingItem = this.uploadingQueue.find((entry, i) => {
            if (entry.item.getId() === file.getId()) {
                itemIndex = i;
                return true;
            }
            return false;
        });
        if (uploadingItem) {
            uploadingItem.subscriptions.forEach(entry => {
                entry.unsubscribe();
            });
            if (uploadingItem.item.isUploading) {
                uploadingItem.item.cancel();
            }
            this.uploadingQueue.splice(itemIndex, 1);
        }
    }

    public uploadAll() {
        if (this.queueOptions.parallel) {
            this.uploadingQueue.forEach(uploadingItem => {
                if (!uploadingItem.item.isUploading && !uploadingItem.item.isUploaded) {
                    this.uploadItem(uploadingItem);
                }
            });
        } else {
            this.uploadingQueue.forEach(item => {
               item.markedToUpload = true;
            });
           const itemToUpload = this.getNextToUpload();
           if (itemToUpload) {
              this.uploadItem(itemToUpload);
           }
        }
    }

    private getNextToUpload() {
        let itemToUpload;
        for (const uploadingItem of this.uploadingQueue) {
            if (!uploadingItem.item.isUploaded
                && !uploadingItem.item.isUploading
                && !uploadingItem.item.isError
                && !uploadingItem.item.isPause) {
                itemToUpload = uploadingItem;
                break;
            }
        }
        return itemToUpload;
    }


    public cancelAll() {
        this.uploadingQueue.forEach(uploadingItem => {
            uploadingItem.item.cancel();
        });
        this.queueProgress = 0;
    }

    public clearQueue() {
        this.uploadingQueue.forEach(uploadingItem => {
            uploadingItem.subscriptions.forEach(entry => {
                entry.unsubscribe();
            });
            uploadingItem.item.cancel();
        });
        this.uploadingQueue = [];
        this.queueProgress = 0;
    }

    private calculateProgress() {
        let totalBytes = 0;
        let totalSent = 0;
        this.uploadingQueue.forEach(uploadingItem => {
            totalBytes += uploadingItem.item.fileLike.size;
            totalSent += uploadingItem.item.bytesSent;
        });
        this.queueProgress = Number(((totalSent * 100) / totalBytes).toFixed(2));
        console.log(this.queueProgress);
        console.log(totalBytes);
        console.log(totalSent);
    }

    private uploadItem(uploadingItem: UploadingItem) {
        uploadingItem.item.upload();
        this.isFilesUploading();
    }

    private isFilesUploading() {
        let isUploading = false;
        for (const uploadingItem of this.uploadingQueue) {
            if (uploadingItem.item.isUploading) {
                isUploading = true;
                break;
            }
        }
        this.isUploading = isUploading;
    }


}

