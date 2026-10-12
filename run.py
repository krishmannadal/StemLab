import uvicorn
if __name__=='__main__':
    print('\nStemLab is available at http://127.0.0.1:8000\n')
    uvicorn.run('app:app',host='127.0.0.1',port=8000)
