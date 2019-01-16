import {Subject} from 'rxjs/Subject';
import {HttpHeaders} from '@angular/common/http';
import {FileLikeObject} from './file-like-object.class';
import {FileType} from './file-type.class';
import {v4 as uuidv4} from 'uuid';
import {Observable} from 'rxjs/Observable';

export type ParsedResponseHeaders = { [headerFieldName: string]: string };
export type FilterFunction = {
    name: string,
    fn: (item?: FileLikeObject, options?: UploadOptions) => boolean
};
export type FileItemEventResponse = {
    item: FileItem;
    response: string;
    status: number;
    headers: ParsedResponseHeaders;
};

export interface UploadOptions {
    allowedMimeType?: string[];
    allowedFileType?: string[];
    autoUpload?: boolean;
    filters?: FilterFunction[];
    headers?: HttpHeaders;
    method?: string;
    maxFileSize?: number;
    url?: string;
    disableMultipart?: boolean;
    itemAlias?: string;
    additionalParameter?: { [key: string]: any };
    parametersBeforeFiles?: boolean;
    formatDataFunction?: Function;
    formatDataFunctionIsAsync?: boolean;
    withCredentials?: boolean;
}

export class FileItem {
    private _id: string;
    private errorSubject = new Subject<FileItemEventResponse>();
    private successSubject = new Subject<FileItemEventResponse>();
    private progressSubject = new Subject();
    private cancelSubject = new Subject<FileItemEventResponse>();
    private pauseSubject = new Subject<FileItemEventResponse>();

    private options: UploadOptions;

    private _xhr: XMLHttpRequest;
    private _file: File;
    private _notModificableFile: File;
    public fileLike: FileLikeObject;

    public progress: number;
    public bytesSent = 0;
    public isReady = false;
    public isUploading = false;
    public isUploaded = false;
    public isSuccess = false;
    public isCancel = false;
    public isError = false;
    public isPause = false;

    constructor(file: File, options: UploadOptions) {
        this.setOptions(options);
        this._id = uuidv4();
        this._file = file;
        this._notModificableFile = this._file;
        this.fileLike = new FileLikeObject(this._file);
        if (this.options.maxFileSize) {
            this.options.filters.unshift({name: 'fileSize', fn: this._fileSizeFilter});
        }

        if (this.options.allowedFileType) {
            this.options.filters.unshift({name: 'fileType', fn: this._fileTypeFilter});
        }

        if (this.options.allowedMimeType) {
            this.options.filters.unshift({name: 'mimeType', fn: this._mimeTypeFilter});
        }

        if (this.options.autoUpload) {
           this.upload();
        }
    }

    public onError(): Observable<FileItemEventResponse> {
        return this.errorSubject.asObservable();
    }

    public onSuccess(): Observable<FileItemEventResponse> {
        return this.successSubject.asObservable();
    }

    public onProgress() {
        return this.progressSubject.asObservable();
    }

    public onCancel(): Observable<FileItemEventResponse> {
        return this.cancelSubject.asObservable();
    }

    public onPause(): Observable<FileItemEventResponse> {
        return this.pauseSubject.asObservable();
    }

    public getId() {
        return this._id;
    }

    public cancel() {
        if (this.isUploading) {
            this.isCancel = true;
            this._xhr.abort();
        }
    }

    public pause() {
        if (this.isUploading) {
            this.isPause = true;
            this._xhr.abort();
        }
    }

    public upload() {
        this.isReady = true;
        this.isUploading = true;
        this.isUploaded = false;
        this.isSuccess = false;
        this.isCancel = false;
        this.isError = false;
        this.isPause = false;
        this._xhrTransport();
    }

    public validateFile(): boolean {
        const filters = this.options.filters;
        return !filters.length ? true : filters.every((filter: FilterFunction) => {
            const success = filter.fn.call(this.fileLike, this.options);
            if (success) {
                return success;
            }
            throw new Error(filter.name);
        });
    }

    public setOptions(options: UploadOptions) {
        this.options = options;
        if (!this.options.formatDataFunction) {
            this.options.formatDataFunction = (item: FileItem) => {
                return item._file;
            };
        }
    }

    private _mimeTypeFilter(item: FileLikeObject): boolean {
        return !(this.options.allowedMimeType && this.options.allowedMimeType.indexOf(item.type) === -1);
    }

    private _fileSizeFilter(item: FileLikeObject): boolean {
        return !(this.options.maxFileSize && item.size > this.options.maxFileSize);
    }

    private _fileTypeFilter(item: FileLikeObject): boolean {
        return !(this.options.allowedFileType &&
            this.options.allowedFileType.indexOf(FileType.getMimeClass(item)) === -1);
    }

    protected _xhrTransport(): any {
        let xhr = this._xhr = new XMLHttpRequest();
        let sendable: any;
        if (this._file.size <= 0) {
            throw new TypeError('The file specified is no longer valid');
        }
        if (!this.options.disableMultipart) {
            sendable = new FormData();
            const appendFile = () => sendable.append(this.options.itemAlias, this._file, this._file.name);
            if (!this.options.parametersBeforeFiles) {
                appendFile();
            }

            // For AWS, Additional Parameters must come BEFORE Files
            if (this.options.additionalParameter !== undefined) {
                Object.keys(this.options.additionalParameter).forEach((key: string) => {
                    let paramVal = this.options.additionalParameter[key];
                    // Allow an additional parameter to include the filename
                    if (typeof paramVal === 'string' && paramVal.indexOf('{{file_name}}') >= 0) {
                        paramVal = paramVal.replace('{{file_name}}', this._file.name);
                    }
                    sendable.append(key, paramVal);
                });
            }

            if (this.options.parametersBeforeFiles) {
                appendFile();
            }
        } else {
            sendable = this.options.formatDataFunction(this);
        }

        xhr.upload.onprogress = (event: any) => {
            let progress = Math.round(event.lengthComputable ? event.loaded * 100 / event.total : 0);
            console.log("On progress xhr");
            console.log(event.total);
            console.log(event.loaded);
            this._onProgress(progress, event.loaded);
        };
        xhr.onload = () => {
            let headers = this._parseHeaders(xhr.getAllResponseHeaders());
            let response = this._transformResponse(xhr.response, headers);
            let gist = this._isSuccessCode(xhr.status) ?
                this._onSuccess(response, xhr.status, headers) : this._onError(response, xhr.status, headers);
        };
        xhr.onerror = () => {
            let headers = this._parseHeaders(xhr.getAllResponseHeaders());
            let response = this._transformResponse(xhr.response, headers);
            this._onError(response, xhr.status, headers);
        };
        xhr.onabort = () => {
            let headers = this._parseHeaders(xhr.getAllResponseHeaders());
            let response = this._transformResponse(xhr.response, headers);
            if (this.isCancel) {
                this._onCancel(response, xhr.status, headers);
            } else {
                this._onPause(response, xhr.status, headers);
            }
        };
        xhr.open(this.options.method, this.options.url, true);
        xhr.withCredentials = this.options.withCredentials;
        if (this.options.headers) {
            for (let header of this.options.headers.keys()) {
                xhr.setRequestHeader(header, this.options.headers.get(header));
            }
        }

        if (this.options.formatDataFunctionIsAsync) {
            sendable.then(
                (result: any) => xhr.send(JSON.stringify(result))
            );
        } else {
            xhr.send(sendable);
        }
    }

    private _onProgress(progress: number, bytesSent: any): void {
        this.progress = progress;
        this.bytesSent = bytesSent;
        this.progressSubject.next({item: this, progress: progress, bytesSent: bytesSent});
    }

    protected _parseHeaders(headers: string): ParsedResponseHeaders {
        let parsed: any = {};
        let key: any;
        let val: any;
        let i: any;
        if (!headers) {
            return parsed;
        }
        headers.split('\n').map((line: any) => {
            i = line.indexOf(':');
            key = line.slice(0, i).trim().toLowerCase();
            val = line.slice(i + 1).trim();
            if (key) {
                parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
            }
        });
        return parsed;
    }

    protected _transformResponse(response: string, headers: ParsedResponseHeaders): string {
        return response;
    }

    protected _isSuccessCode(status: number): boolean {
        return (status >= 200 && status < 300) || status === 304;
    }

    private _onSuccess(response: string, status: number, headers: ParsedResponseHeaders): void {
        this.isReady = false;
        this.isUploading = false;
        this.isUploaded = true;
        this.isSuccess = true;
        this.isCancel = false;
        this.isError = false;
        this.progress = 100;
        this.isPause = false;
        this.bytesSent = this._file.size;
        this.successSubject.next({item: this, response: response, status: status, headers: headers});
    }

    private _onError(response: string, status: number, headers: ParsedResponseHeaders): void {
        this.isReady = false;
        this.isUploading = false;
        this.isUploaded = false;
        this.isSuccess = false;
        this.isCancel = false;
        this.isError = true;
        this.progress = 0;
        this.isPause = false;
        this.resetToOriginalFile();
        this.errorSubject.next({item: this, response: response, status: status, headers: headers});
    }

    private _onCancel(response: string, status: number, headers: ParsedResponseHeaders): void {
        this.isReady = false;
        this.isUploading = false;
        this.isUploaded = false;
        this.isSuccess = false;
        this.isCancel = true;
        this.isError = false;
        this.isPause = false;
        this.resetToOriginalFile();
        this.cancelSubject.next({item: this, response: response, status: status, headers: headers});
    }

    private _onPause(response: string, status: number, headers: ParsedResponseHeaders): void {
        this.isReady = false;
        this.isUploading = false;
        this.isUploaded = false;
        this.isSuccess = false;
        this.isCancel = false;
        this.isError = false;
        this.isPause = true;
        this.sliceFile();
        this.pauseSubject.next({item: this, response: response, status: status, headers: headers});
    }

    public sliceFile(offset?: number) {
        this.bytesSent = offset ? offset : this.bytesSent;
        this._file = new File([this._file.slice(this.bytesSent , this._file.size)], this._file.name, {
            lastModified: this._file.lastModifiedDate,
            type: this._file.type
        });
    }

    public resetToOriginalFile() {
        this.bytesSent = 0;
        this._file = this._notModificableFile;
    }

}
