# moontech-file-upload

## About
Based on ng2-file-upload 

Allow you to upload a file or files getting all info that you need

Allow paralel upload

## Installation

To install this library, run:

```bash
$ npm install moontech-file-upload --save
```

## Consuming your library

Once you have published your library to npm, you can import your library in any Angular application by running:

```bash
$ npm install @angular/moontech-file-upload
```

and then from your Angular `AppModule`:

```typescript
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';

// Import your library
import { MoontechFileUploadModule } from 'moontech-file-upload';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,

    // Specify your library as an import
    MoontechFileUploadModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

You can use FileItem class to instantiate a file and upload it for the configured server

```typescript
import {FileItem, FileItemEventResponse, QueueController, UploadOptions, FilterFunction, FileLikeObject} from 'moontech-file-upload';
import {HttpHeaders} from '@angular/common/http';

const customValidator: FilterFunction = {
    name: 'Allways Valid',
    fn: (item: FileLikeObject, options: UploadOptions) => {
        console.log("Im valid");
        return true;
    }
}; 
const uploadOptions: UploadOptions = {
        allowedFileType: ['image', 'video'], //used for validation
        autoUpload: false, //if true on instantiate a file item it will start upload 
        filters: [customValidator], //custom validator used for validate method
        headers: new HttpHeaders({
                         'Content-Type': 'application/json',
                         'Authorization': 'Bearer ' + this.acessToken,
                         'Accept': 'application/vnd.vimeo.*+json;version=3.4',
                }),
        method: 'POST',
        maxFileSize: 100000, //used for validation
        url: "http://www.test.upload.com/upload", //url to send file
        disableMultipart: true, //if true will not send a form data in the request
        itemAlias: 'user-image', //name for form data
        formatDataFunction: (item: FileItem) => {
                                return item._file;
                            } //used to format file before upload
};
const fileItem = new FileItem(file, uploadOptions);
try {
    fileItem.validateFile(); //throw error with name of the validation function
    fileItem.onSuccess().subscribe((value: FileItemEventResponse) => {
       //on success 
    });
    fileItem.onPause().subscribe((value: FileItemEventResponse) => {
        //on pause
    });
    fileItem.onError().subscribe((value: FileItemEventResponse) => {
        // on error
    });
    fileItem.onCancel().subscribe((value: FileItemEventResponse) => {
        //on cancel
    });
    fileItem.onProgress().subscribe(value => {
        value.item; 
        value.progress;
        value.bytesSent;
    });
    fileItem.setOptions({});//override old options
    fileItem.upload(); //upload file
    fileItem.pause(); //pause file and slice actual file to start in fileItem.bytesSent
    fileItem.upload(); //will send file with sliced file
    fileItem.resetToOriginalFile(); //reset file
    fileItem.sliceFile(20); //slice file
    fileItem.cancel(); //cancel upload and reset file
    fileItem.progress //progress of upload
}catch (e) {
  console.log(e);
}

```
File Items can be used with a QueueController that will control total progress of all uploads
upload all files in paralel if you want.
```typescript
import {FileItem, FileItemEventResponse, QueueController, UploadOptions, FilterFunction, FileLikeObject} from 'moontech-file-upload';
import {HttpHeaders} from '@angular/common/http';

const queue = new QueueController({
    paralel: true, //upload in paralel
    removeAfterUpload: false, //remove fileItem from queue after upload success
    queueLimit: 200, //max fileItems in queue
});
const customValidator: FilterFunction = {
    name: 'Allways Valid',
    fn: (item: FileLikeObject, options: UploadOptions) => {
        console.log("Im valid");
        return true;
    }
}; 
const uploadOptions: UploadOptions = {
        allowedFileType: ['image', 'video'], //used for validation
        autoUpload: false, //if true on instantiate a file item it will start upload 
        filters: [customValidator], //custom validator used for validate method
        headers: new HttpHeaders({
                         'Content-Type': 'application/json',
                         'Authorization': 'Bearer ' + this.acessToken,
                         'Accept': 'application/vnd.vimeo.*+json;version=3.4',
                }),
        method: 'POST',
        maxFileSize: 100000, //used for validation
        url: "http://www.test.upload.com/upload", //url to send file
        disableMultipart: true, //if true will not send a form data in the request
        itemAlias: 'user-image', //name for form data
        formatDataFunction: (item: FileItem) => {
                                return item._file;
                            } //used to format file before upload
};
const fileItem = new FileItem(file, uploadOptions);
queue.addFileItemsToQueue([fileItem]);
queue.addFilesToQueue([file]); //create a file Item

queue.onItemCancel() //observable to item cancel
queue.onItemError() //observable to item error
queue.onItemPause() //observable to item pause
queue.onItemProgress() //observable to progress
queue.onItemUploaded() //observable to iten finish

queue.uploadAll();
queue.cancelAll(); //cancel all
queue.clearQueue(); //clear queue
queue.getNotUploadedItems();
queue.getNotUploadedItems();
queue.isUploading //if is any file uploading
queue.queueProgress //actual progress

```


## Development

To generate all `*.js`, `*.d.ts` and `*.metadata.json` files:

```bash
$ npm run build
```

To lint all `*.ts` files:

```bash
$ npm run lint
```

## License

MIT © [Luã Faria](mailto:lfaria@unifei.edu.br)
